<?php

namespace App\Services;

use App\Events\ProjectDataIngested;
use App\Jobs\ProcessRecordEnrichment;
use App\Models\Project;
use App\Models\Record;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

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
        $batchId = (string) Str::uuid();

        $rows = $this->buildRowsAndHeartbeats($project, $records, $batchId);

        if ($rows !== []) {
            Record::insert($rows);

            // Re-query the inserted rows by the unique batch_id so two
            // concurrent ingest jobs cannot cross-dispatch each other's
            // enrichment work. Every inserted row gets a job (no
            // fingerprint-based skipping) so types like `command` whose
            // calculateFingerprint() returns null still receive the
            // checkThresholds() pass downstream.
            $inserted = Record::query()
                ->where('batch_id', $batchId)
                ->get(['id', 'type']);

            foreach ($inserted as $row) {
                ProcessRecordEnrichment::dispatch($project->id, $row->id, $row->type);
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
     * Build the bulk-insert row payload for non-heartbeat records and upsert
     * heartbeats inline. Returns the array suitable for Record::insert().
     *
     * @param  array<int, array<string, mixed>>  $records
     * @return array<int, array<string, mixed>>
     */
    private function buildRowsAndHeartbeats(Project $project, array $records, string $batchId): array
    {
        $batchStart = now();
        $rows = [];

        foreach ($records as $data) {
            $type = $data['t'] ?? null;
            if (! $type) {
                continue;
            }

            if ($type === 'heartbeat') {
                $this->upsertHeartbeat($project, $data);

                continue;
            }

            $rows[] = [
                'project_id' => $project->id,
                'type' => $type,
                'payload' => json_encode($data),
                'fingerprint' => $this->calculateFingerprint($type, $data),
                'batch_id' => $batchId,
                'created_at' => $batchStart,
            ];
        }

        return $rows;
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
            // Includes `command` so the threshold-check enrichment path can
            // resolve a stable key for it. Without this branch, commands fall
            // to default => null and downstream threshold issues never fire.
            'command', 'scheduled-task' => $payload['command'] ?? '',
            'mail' => $payload['mailable'] ?? '',
            'notification' => ($payload['notification'] ?? '').($payload['channel'] ?? ''),
            default => null,
        };

        return $id ? md5($id) : null;
    }
}
