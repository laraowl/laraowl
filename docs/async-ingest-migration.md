# Phase 2 — Async Ingest Migration Guide

**Audience:** LaraOwl server operators upgrading an existing self-hosted
installation.
**Scope:** Server-side only. Client libraries (`laraowl/client`) do not need
any changes — the public `/api/records` ingest endpoint is unchanged.

---

## Background / Why This Change

Before Phase 2, LaraOwl's ingest pipeline looked like this:

1. The client package on the monitored Laravel app called
   `HttpIngest::transmit()`, which performed a **synchronous Guzzle `POST`**
   to the LaraOwl server's `/api/records` endpoint.
2. `IngestController::__invoke()` dispatched a single
   `ProcessIngestedRecords` job onto the configured queue (default:
   `database`).
3. A queue worker on the LaraOwl server picked up the job and called
   `IngestService::ingest()`. Inside that method:
   - Everything ran inside a `DB::transaction` block.
   - Each record was inserted with `Record::create($attrs)` in a loop —
     one round-trip per record.
   - For every record, the worker **synchronously** ran:
     - exception grouping / issue upsert (`handleException`)
     - security analysis (`SecurityService::analyze` /
       `SecurityService::audit`)
     - threshold checks (`checkThresholds` →
       `handleSlowPerformance`)
     - alert dispatch (`AlertService`)
   - After the loop, `ProjectDataIngested::dispatch($project)` fired a
     broadcast on every batch, with no throttling.

### Symptoms operators reported

Under load — typically during traffic spikes on the **monitored** app —
this design produced two compounding problems:

- **Worker-blocking on the monitored app.** The client's
  `HttpIngest::transmit()` call was synchronous. Even though the server
  responded quickly, the Laravel request worker handling a chat send /
  vote submit / raise-hand action on the monitored app was occupied for
  the full HTTP round-trip. With a small `php-fpm` pool, head-of-line
  blocking surfaced as 1–3 minute UI delays for end users during
  high-traffic events.
- **Throughput collapse on the LaraOwl server.** A single
  `laraowl-queue` worker processing the `database` connection had to
  finish *all* enrichment work for batch N before starting batch N+1.
  Each batch typically held 50–500 records, so a slow security audit on
  one record stalled the entire pipeline. The `jobs` table grew
  unbounded; `ProjectDataIngested` broadcasts fanned out faster than the
  dashboard could re-render.

The root cause was therefore not any single slow query — it was the
combination of:

- **Sync HTTP transmit** on the client side keeping a request worker
  busy.
- **N+1 INSERTs** inside `DB::transaction` on the server.
- **A single DB-backed queue worker** doing both the cheap
  insert step *and* the expensive enrichment step in the same job.

Phase 2 addresses all three layers on the server side without requiring
any client change.

---

## What Changed in Phase 2

The migration introduces five concrete changes on the server. None of
them require redeploying the monitored application.

- **Bulk insert.** `IngestService::ingestBulk()` performs a single
  `Record::insert($rows)` for the whole batch instead of N
  `Record::create()` calls. INSERT…VALUES…N is already atomic, so the
  outer `DB::transaction` wrapper was removed.
- **Async per-record enrichment.** The expensive work (exception
  grouping, security analysis, threshold checks) moved out of
  `IngestService` into a new `RecordEnrichmentService`, and is now
  dispatched as a separate `ProcessRecordEnrichment` job per record on
  the `laraowl-enrichment` queue. This lets enrichment scale
  horizontally independent of ingest throughput.
- **Throttled broadcasts.** `ProjectDataIngested` is now fired at most
  once per second per project, guarded by
  `Cache::lock("laraowl:broadcast:project:{id}",
  config('laraowl.broadcast_throttle_sec', 1))`. Dashboards still feel
  live but the WebSocket fan-out is bounded.
- **Redis is the default queue connection.** `config/queue.php` now
  defaults to `'redis'` instead of `'database'`. The `database`
  connection is still defined and available for rollback.
- **Two named queues.**
  - `laraowl-ingest` — small, fast bulk-insert jobs.
  - `laraowl-enrichment` — per-record enrichment, can be scaled
    independently.
  Workers should be started per-queue so a backlog of enrichment work
  cannot block a fresh bulk insert from being persisted.

---

## Compatibility

- **Client libraries: no changes required.** The `/api/records` HTTP
  endpoint, its authentication, request shape, and response are all
  identical. Any version of `laraowl/client` you have deployed today
  will continue to work after the server upgrade.
- **`IngestService::ingest()` is deprecated but still works.** It is
  now a thin wrapper that calls `ingestBulk()` internally. Any
  third-party code or custom job that calls `ingest()` directly will
  keep functioning. Plan to migrate callers to `ingestBulk()` over time
  but it is not required for the upgrade itself.
- **`ProcessIngestedRecords` job class still exists.** Its `handle()`
  method now calls `ingestBulk()` and the job is dispatched on the
  `laraowl-ingest` queue. Any in-flight jobs on the old `database`
  queue from before the upgrade will still drain — see
  [Migration Steps](#migration-steps).

---

## Migration Steps

The upgrade is non-destructive: ingested records are not touched, and
the `jobs` table is still available if you need to roll back. Plan for
roughly 5 minutes of queue-worker downtime during the cutover.

### 1. Pull the new server code

```bash
cd /path/to/laraowl
git fetch origin
git checkout <release-tag-or-main>
composer install --no-dev --optimize-autoloader
php artisan migrate --force
```

No new migrations are required by Phase 2 itself, but running `migrate`
is safe and picks up anything else in the release.

### 2. Update `.env`

Edit the server's `.env` (not `.env.example`) and apply:

```env
# Was: QUEUE_CONNECTION=database
QUEUE_CONNECTION=redis

# New keys (place near the existing QUEUE_* / REDIS_* entries)
REDIS_QUEUE=default
LARAOWL_BROADCAST_THROTTLE_SEC=1
LARAOWL_QUEUE_REPLICAS=4
```

Then clear the cached config so the new connection takes effect:

```bash
php artisan config:clear
php artisan config:cache
```

If you previously cached routes/views, re-cache them too:

```bash
php artisan route:cache
php artisan view:cache
```

### 3. Drain and stop the old worker

Before swapping to Redis-backed workers, let the old `database` queue
finish in-flight jobs so nothing is left orphaned in the `jobs` table.

```bash
# Tell the old worker(s) to finish their current job and exit.
php artisan queue:restart

# Wait for the DB queue to reach zero.
php artisan tinker --execute='echo DB::table("jobs")->count();'
# Re-run until it prints 0.
```

If you manage the worker via Supervisor, stop the old program:

```bash
sudo supervisorctl stop laraowl-queue:*
```

The old `[program:laraowl-queue]` block from the README's Production
section is no longer used as-is — replace it with the two blocks below.

### 4. Start the two new workers

The new architecture needs **two** queue workers — one per named queue.
Run them with their own `--queue` flag so a slow enrichment job cannot
block a fresh bulk insert.

```bash
# Bulk insert worker — fast, low concurrency is fine.
php artisan queue:work redis \
    --queue=laraowl-ingest \
    --sleep=0 \
    --tries=3 \
    --max-time=3600

# Enrichment worker — slower, scale this horizontally.
php artisan queue:work redis \
    --queue=laraowl-enrichment \
    --sleep=1 \
    --tries=3 \
    --max-time=3600
```

Example Supervisor configuration that replaces the old single
`laraowl-queue` program:

```ini
[program:laraowl-ingest]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/laraowl/artisan queue:work redis --queue=laraowl-ingest --sleep=0 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=1
redirect_stderr=true
stdout_logfile=/var/log/laraowl/queue-ingest.log

[program:laraowl-enrichment]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/laraowl/artisan queue:work redis --queue=laraowl-enrichment --sleep=1 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
numprocs=4
redirect_stderr=true
stdout_logfile=/var/log/laraowl/queue-enrichment.log
```

`numprocs=1` is typically enough for `laraowl-ingest` because the job
body is just a bulk INSERT and a fan-out dispatch. Scale
`laraowl-enrichment` first (the default of `4` matches
`LARAOWL_QUEUE_REPLICAS`).

### 5. Scale enrichment workers horizontally

If you run LaraOwl under docker-compose, the
`LARAOWL_QUEUE_REPLICAS` env var is read by the enrichment service so
you can scale via:

```bash
LARAOWL_QUEUE_REPLICAS=8 docker compose up -d --scale laraowl-enrichment=8
```

(The exact service name depends on your compose file — Phase 3 will
ship a reference compose. For now, use the env var to drive
`numprocs` in Supervisor or `replicas` in your orchestrator.)

Tune the count by watching enrichment queue depth (see
[Verification](#verification)). The bulk-ingest worker rarely needs
more than one replica.

### 6. Restart Reverb and the scheduler

Reverb and the scheduler do not need configuration changes for Phase
2, but restart them so they pick up the new cached config:

```bash
sudo supervisorctl restart laraowl-reverb
sudo supervisorctl restart laraowl-scheduler  # if you run it via supervisor
```

---

## Verification

Run these checks immediately after cutover, then again 5 and 30 minutes
later, to confirm the migration succeeded.

### Redis queue depth

The bulk-ingest queue should sit near zero — jobs are processed almost
as fast as they arrive.

```bash
redis-cli LLEN queues:laraowl-ingest
# Expected: 0 to a handful most of the time.
```

The enrichment queue may have a backlog under load but it should be
steady or draining — never monotonically growing.

```bash
redis-cli LLEN queues:laraowl-enrichment
# Expected: steady or trending down.
```

If `laraowl-enrichment` keeps growing, scale up replicas (see step 5
above).

### Database queue is empty

The `jobs` table should be near zero now that the queue connection is
Redis. A small non-zero count is expected if other Laravel features
(notifications, mail) still target the `database` connection.

```bash
php artisan tinker --execute='echo DB::table("jobs")->count();'
# Expected: 0 or near-zero.
```

If you see a large number, the old worker may not have been stopped or
`QUEUE_CONNECTION` may still be cached as `database`. Re-run
`php artisan config:clear && php artisan config:cache` and confirm with
`php artisan tinker --execute='echo config("queue.default");'`.

### Monitored-app latency drops

The most user-visible signal: on the **monitored** Laravel app,
`/livewire/update` (or whatever endpoint your end-users hit during the
load event) should show dramatically lower p95 latency compared to the
pre-migration baseline. The improvement is driven by the bulk insert
plus the throttled broadcast — both reduce the time the server holds
the client's `HttpIngest::transmit()` request open.

If you do not see an improvement:

- Confirm `QUEUE_CONNECTION=redis` is actually loaded
  (`php artisan tinker --execute='echo config("queue.default");'`).
- Confirm both workers are running
  (`ps auxf | grep queue:work` should show two distinct `--queue=...`
  processes).
- Check the LaraOwl dashboard's own Requests view for the
  monitored app's project — `/api/records` p95 should also be lower.

### Broadcast throttle

In a Redis MONITOR session (`redis-cli MONITOR`), you should see at
most one `ProjectDataIngested` broadcast per project per
`LARAOWL_BROADCAST_THROTTLE_SEC` window, even during heavy ingest. If
you see more than that, confirm the cache store driving `Cache::lock`
is Redis (`config('cache.default')`).

---

## Rollback

The migration is reversible. Records inserted under Phase 2 are stored
in the same `records` table with the same schema — no data is lost or
re-shaped. Rollback only switches which queue connection processes new
work.

### 1. Stop the new workers

```bash
sudo supervisorctl stop laraowl-ingest:*
sudo supervisorctl stop laraowl-enrichment:*
```

### 2. Flip the env back

In `.env`:

```env
QUEUE_CONNECTION=database
```

Then:

```bash
php artisan config:clear
php artisan config:cache
```

### 3. Restart the original worker

Re-enable the old single `laraowl-queue` Supervisor program (or run
the equivalent `php artisan queue:work --queue=default` command).

```bash
sudo supervisorctl start laraowl-queue:*
```

### 4. Verify

```bash
php artisan tinker --execute='echo config("queue.default");'
# Expected: database
```

New ingest batches will now flow through the deprecated `ingest()`
path again. There is no data migration needed — the `jobs` table is
the same one the old code used.

If you rolled back to debug an enrichment bug, drain Redis once you're
back on `database`:

```bash
redis-cli DEL queues:laraowl-ingest queues:laraowl-enrichment
```

This is safe because anything still pending there would have been
duplicated into the new code path; if you have not rolled back, do not
run this command.

---

## Open Questions / Future Work

These are deliberately **not** in Phase 2 but are on the roadmap.

- **Horizon integration.** Moving the two named queues onto Laravel
  Horizon would give operators a visual dashboard for backlog,
  throughput, and failed jobs, plus auto-balancing of workers between
  queues. Phase 2 keeps things on plain `queue:work` so the upgrade
  has no new dependencies.
- **Per-project enrichment shards.** A noisy project (one with a
  sustained exception spike) can starve other projects' enrichment.
  A future change may shard `laraowl-enrichment` by project ID into
  named sub-queues (`laraowl-enrichment-{shard}`) so a single tenant
  cannot monopolise a worker pool.
- **Backpressure.** Today, if `laraowl-enrichment` cannot keep up,
  the queue depth grows unbounded. Phase 3 may introduce a backpressure
  signal — for example, returning `429 Too Many Requests` from
  `/api/records` when enrichment depth exceeds a configurable
  threshold — so the client library can apply local sampling instead
  of the server silently buffering.
- **Reference docker-compose.** Phase 3 will ship a tested compose
  file with the two worker services already separated and
  `LARAOWL_QUEUE_REPLICAS` wired through. Until then, see the
  Supervisor blocks in step 4 as the reference topology.

If you hit a migration issue not covered here, please open an issue on
the LaraOwl GitHub repository with your Redis queue depths,
`config('queue.default')` output, and a snippet from
`storage/logs/laravel.log` around the failure.
