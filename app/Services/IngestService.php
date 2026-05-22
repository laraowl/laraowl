<?php

namespace App\Services;

use App\Events\ProjectDataIngested;
use App\Jobs\ProcessRecordEnrichment;
use App\Models\Project;
use App\Models\Record;
use Illuminate\Support\Facades\Cache;

class IngestService
{
    protected AlertService $alertService;

    protected SecurityService $securityService;

    public function __construct(AlertService $alertService, SecurityService $securityService)
    {
        $this->alertService = $alertService;
        $this->securityService = $securityService;
    }

    /**
     * Bulk-ingest a batch of records for a project.
     *
     * Performs a single Record::insert() for non-heartbeat rows, upserts
     * heartbeats inline (they are not bulk-insertable), then dispatches a
     * per-record enrichment job for each inserted row. Broadcast of
     * ProjectDataIngested is rate-limited via a non-blocking cache lock.
     */
    public function ingestBulk(Project $project, array $records): void
    {
        $batchStart = now();
        $rows = [];
        $fingerprints = [];

        foreach ($records as $data) {
            $type = $data['t'] ?? null;
            if (! $type) {
                continue;
            }

            if ($type === 'heartbeat') {
                $this->upsertHeartbeat($project, $data);

                continue;
            }

            $fingerprint = $this->calculateFingerprint($type, $data);

            $rows[] = [
                'project_id' => $project->id,
                'type' => $type,
                'payload' => json_encode($data),
                'fingerprint' => $fingerprint,
                'created_at' => $batchStart,
            ];

            if ($fingerprint !== null) {
                $fingerprints[] = $fingerprint;
            }
        }

        if ($rows !== []) {
            Record::insert($rows);

            // Re-query the inserted records to get their IDs so we can
            // dispatch a per-record enrichment job. Records lacking a
            // fingerprint (e.g. cache-event, user, command — types whose
            // calculateFingerprint() returns null) are intentionally skipped
            // here because the enrichment paths (handleException,
            // checkThresholds) do not apply to them in the original code path
            // either. Two concurrent ingest batches that share a fingerprint
            // inside the same second could cross-dispatch enrichment for each
            // other's rows; the downstream enrichment job is idempotent
            // (firstOrCreate by issue hash) so the worst case is a duplicate
            // dispatch, not corrupted data.
            $fingerprints = array_values(array_unique($fingerprints));
            if ($fingerprints !== []) {
                $inserted = Record::query()
                    ->where('project_id', $project->id)
                    ->whereIn('fingerprint', $fingerprints)
                    ->where('created_at', '>=', $batchStart)
                    ->get(['id', 'type']);

                foreach ($inserted as $row) {
                    ProcessRecordEnrichment::dispatch($project->id, $row->id, $row->type);
                }
            }
        }

        $throttle = (int) config('laraowl.broadcast_throttle_sec', 1);
        $lock = Cache::lock("laraowl:broadcast:project:{$project->id}", $throttle);
        if ($lock->get()) {
            ProjectDataIngested::dispatch($project);
        }
    }

    /**
     * Process incoming records and handle issue grouping.
     *
     * @deprecated Use {@see self::ingestBulk()} instead. Retained for
     *             back-compat with callers that have not yet migrated.
     */
    public function ingest(Project $project, array $records): void
    {
        $this->ingestBulk($project, $records);
    }

    /**
     * Upsert a heartbeat row inline. Heartbeats are upserts and cannot be
     * batched alongside Record inserts.
     *
     * @param  array<string, mixed>  $data
     */
    protected function upsertHeartbeat(Project $project, array $data): void
    {
        $slug = $data['slug'] ?? 'default';
        $heartbeat = $project->heartbeats()->firstOrCreate(
            ['slug' => $slug],
            [
                'name' => $data['name'] ?? ucfirst($slug),
                'interval_minutes' => $data['interval'] ?? 15,
                'status' => 'active',
            ]
        );

        $heartbeat->update([
            'last_seen_at' => now(),
            'status' => 'active',
        ]);
    }

    /**
     * Calculate a unique fingerprint for grouping and fast lookup.
     *
     * @param  array<string, mixed>  $payload
     */
    protected function calculateFingerprint(string $type, array $payload): ?string
    {
        if (isset($payload['_group'])) {
            return $payload['_group'];
        }

        $id = match ($type) {
            'request' => ($payload['method'] ?? 'GET').($payload['route_path'] ?? $payload['path'] ?? '/'),
            'exception' => ($payload['class'] ?? '').($payload['message'] ?? ''),
            'query' => $payload['sql'] ?? '',
            'job', 'job-attempt', 'queued-job' => $payload['job'] ?? $payload['name'] ?? $payload['job_class'] ?? '',
            'scheduled-task' => $payload['command'] ?? '',
            'mail' => $payload['mailable'] ?? '',
            'notification' => ($payload['notification'] ?? '').($payload['channel'] ?? ''),
            default => null,
        };

        return $id ? md5($id) : null;
    }
}
