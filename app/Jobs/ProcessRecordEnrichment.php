<?php

namespace App\Jobs;

use App\Models\Project;
use App\Models\Record;
use App\Services\RecordEnrichmentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Async per-record enrichment job.
 *
 * Dispatched once per ingested record by IngestService::ingestBulk().
 * Runs on a dedicated `laraowl-enrichment` queue so heavy security/threshold
 * checks scale independently from the ingest hot path.
 */
class ProcessRecordEnrichment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * Create a new job instance.
     *
     * The named queue is set via onQueue() in the constructor rather than as
     * a property default to stay compatible with PHP 8.4's stricter trait
     * property composition rules — Illuminate\Bus\Queueable already declares
     * `public $queue;` with an implicit null default, and a different default
     * here triggers a fatal composition error on PHP 8.4+.
     */
    public function __construct(
        public int $projectId,
        public int $recordId,
        public string $type,
    ) {
        $this->onQueue(config('laraowl.queues.enrichment', 'laraowl-enrichment'));
    }

    /**
     * Execute the job.
     */
    public function handle(RecordEnrichmentService $enrichment): void
    {
        $project = Project::find($this->projectId);
        $record = Record::find($this->recordId);

        if (! $project || ! $record) {
            return; // record may have been pruned before this job ran
        }

        match ($this->type) {
            'exception' => $enrichment->handleException($project, $record),
            'request' => $enrichment->analyzeSecurityForRequest($project, $record),
            'security-audit' => $enrichment->auditSecurity($project, $record),
            default => null,
        };

        $enrichment->checkThresholds($project, $record);
    }
}
