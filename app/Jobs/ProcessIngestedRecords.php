<?php

namespace App\Jobs;

use App\Models\Project;
use App\Services\IngestService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessIngestedRecords implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    protected $project;

    protected $records;

    /**
     * Create a new job instance.
     *
     * The named queue (`laraowl-ingest`) is set inside the constructor rather
     * than as a property default to stay compatible with PHP 8.4's stricter
     * trait property composition rules — see ProcessRecordEnrichment for the
     * full rationale.
     */
    public function __construct(Project $project, array $records)
    {
        $this->project = $project;
        $this->records = $records;
        $this->onQueue('laraowl-ingest');
    }

    /**
     * Execute the job.
     */
    public function handle(IngestService $ingestService): void
    {
        $ingestService->ingestBulk($this->project, $this->records);
    }
}
