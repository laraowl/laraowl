<?php

namespace App\Services;

use App\Models\Project;
use App\Models\Record;

/**
 * Per-record enrichment work extracted from IngestService so it can run
 * asynchronously via ProcessRecordEnrichment job, decoupling slow
 * security/threshold checks from the bulk-insert hot path.
 */
class RecordEnrichmentService
{
    public function __construct(
        protected AlertService $alertService,
        protected SecurityService $securityService,
    ) {}

    /**
     * Group exceptions into unique issues based on hash and detect spikes.
     */
    public function handleException(Project $project, Record $record): void
    {
        $payload = $record->payload;
        $hash = $payload['_group'] ?? md5($payload['class'].$payload['message'].($payload['file'] ?? '').($payload['line'] ?? ''));

        $issue = $project->issues()->firstOrCreate(
            ['hash' => $hash],
            [
                'title' => $payload['class'],
                'message' => $payload['message'],
                'status' => 'open',
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]
        );

        $issue->increment('occurrences_count');
        $issue->update(['last_seen_at' => now()]);

        if ($issue->wasRecentlyCreated) {
            $this->alertService->notifyNewIssue($issue);
        }

        $record->update(['issue_id' => $issue->id]);

        // Detect Spike
        $this->detectErrorSpike($project);
    }

    /**
     * Analyze a request record for potential security threats.
     */
    public function analyzeSecurityForRequest(Project $project, Record $record): void
    {
        $this->securityService->analyze($project, $record);
    }

    /**
     * Run a security audit against a security-audit record.
     */
    public function auditSecurity(Project $project, Record $record): void
    {
        $this->securityService->audit($project, $record);
    }

    /**
     * Check if a record exceeds any performance thresholds.
     */
    public function checkThresholds(Project $project, Record $record): void
    {
        $payload = $record->payload;
        $duration = $payload['duration'] ?? null;

        if ($duration === null) {
            return;
        }

        // Find applicable thresholds for this project and type
        $thresholdType = match ($record->type) {
            'request' => 'route',
            'job-attempt', 'queued-job' => 'job',
            'command' => 'command',
            'scheduled-task' => 'scheduled-task',
            'query' => 'query',
            default => null,
        };

        if (! $thresholdType) {
            return;
        }

        $key = match ($thresholdType) {
            'route' => $payload['route_path'] ?? $payload['path'] ?? '/',
            'job' => $payload['name'] ?? $payload['job'] ?? 'Unknown',
            'command', 'scheduled-task' => $payload['command'] ?? 'Unknown',
            'query' => $payload['sql'] ?? 'Unknown',
            default => null,
        };

        if (! $key) {
            return;
        }

        $threshold = $project->thresholds()
            ->where('type', $thresholdType)
            ->where('key', $key)
            ->where('is_enabled', true)
            ->first();

        if ($threshold && $duration > $threshold->value) {
            $this->handleSlowPerformance($project, $record, $threshold);
        }
    }

    /**
     * Detect sudden surge in errors.
     */
    public function detectErrorSpike(Project $project): void
    {
        $windowMinutes = $project->settings['spike_window'] ?? 5;
        $threshold = $project->settings['spike_threshold'] ?? 50;

        $count = $project->records()
            ->where('type', 'exception')
            ->where('created_at', '>=', now()->subMinutes($windowMinutes))
            ->count();

        if ($count >= $threshold) {
            // Avoid spamming - only alert once every window
            $lastAlert = $project->settings['last_spike_alert_at'] ?? null;
            if (! $lastAlert || now()->diffInMinutes($lastAlert) >= $windowMinutes) {
                $this->alertService->notifyErrorSpike($project, $count, $windowMinutes);

                // Update last alert time
                $settings = $project->settings ?? [];
                $settings['last_spike_alert_at'] = now();
                $project->update(['settings' => $settings]);
            }
        }
    }

    /**
     * Handle performance threshold violations by creating issues and notifying.
     */
    public function handleSlowPerformance(Project $project, Record $record, $threshold): void
    {
        $hash = md5('slow_performance_'.$threshold->type.'_'.$threshold->key);
        $title = 'Slow '.ucfirst($threshold->type).': '.$threshold->key;
        $message = 'Duration: '.$record->payload['duration'].'ms (Threshold: '.$threshold->value.'ms)';

        $issue = $project->issues()->firstOrCreate(
            ['hash' => $hash],
            [
                'title' => $title,
                'message' => $message,
                'status' => 'open',
                'first_seen_at' => now(),
                'last_seen_at' => now(),
            ]
        );

        $issue->increment('occurrences_count');
        $issue->update([
            'last_seen_at' => now(),
            'message' => $message, // Update with latest duration
        ]);

        if ($issue->wasRecentlyCreated) {
            $this->alertService->notifySlowPerformance($issue);
        }

        $record->update(['issue_id' => $issue->id]);
    }
}
