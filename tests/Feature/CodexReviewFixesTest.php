<?php

use App\Events\ProjectDataIngested;
use App\Jobs\ProcessIngestedRecords;
use App\Jobs\ProcessRecordEnrichment;
use App\Models\Project;
use App\Models\Record;
use App\Models\Team;
use App\Services\IngestService;
use App\Services\RecordEnrichmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * Regression tests for the four issues the Codex review surfaced on the
 * server side:
 *
 *   #3 — `command`-typed records were silently dropped from enrichment
 *        because calculateFingerprint() had no case for them.
 *   #4 — concurrent batches sharing a fingerprint could cross-dispatch
 *        enrichment for each other's rows (now keyed on batch_id).
 *   #5 — handleException used firstOrCreate against a unique-indexed
 *        column, racy under concurrent enrichment; replaced with
 *        createOrFirst.
 *   #6 — broadcast_throttle_sec was read from config but the server repo
 *        had no config/laraowl.php publishing the value; now backed by a
 *        real config file so env wiring works.
 */
function makeFixesProject(): Project
{
    $team = Team::factory()->create();

    return Project::factory()->create([
        'team_id' => $team->id,
        'api_token' => 'fix-test-'.bin2hex(random_bytes(6)),
    ]);
}

it('dispatches enrichment for command-typed records (Codex #3)', function () {
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeFixesProject();

    app(IngestService::class)->ingestBulk($project, [
        ['t' => 'command', 'command' => 'app:custom-import', 'duration' => 5500],
        ['t' => 'command', 'command' => 'app:other-task', 'duration' => 250],
    ]);

    // Both command records must trigger an enrichment dispatch so the
    // checkThresholds() path can examine their duration.
    Bus::assertDispatchedTimes(ProcessRecordEnrichment::class, 2);
    Bus::assertDispatched(ProcessRecordEnrichment::class, fn ($job) => $job->type === 'command');

    // The newly inserted rows must have non-null fingerprints — otherwise
    // future fingerprint-keyed dashboards lose grouping for commands.
    $fingerprints = Record::where('project_id', $project->id)->pluck('fingerprint');
    expect($fingerprints->filter()->count())->toBe(2);
});

it('scopes enrichment dispatch by batch_id so concurrent batches do not cross-trigger (Codex #4)', function () {
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeFixesProject();

    // Same fingerprint across two ingestBulk calls — they MUST receive
    // distinct batch_ids and dispatch enrichment only for their own rows.
    $payload = [['t' => 'request', 'method' => 'GET', 'route_path' => '/api/orders']];

    app(IngestService::class)->ingestBulk($project, $payload);
    app(IngestService::class)->ingestBulk($project, $payload);

    $rows = Record::where('project_id', $project->id)->orderBy('id')->get();
    expect($rows)->toHaveCount(2)
        ->and($rows[0]->batch_id)->not->toBe($rows[1]->batch_id)
        ->and($rows[0]->batch_id)->not->toBeNull()
        ->and($rows[1]->batch_id)->not->toBeNull();

    // Per inserted row exactly one dispatch — no cross-batch fanout.
    Bus::assertDispatchedTimes(ProcessRecordEnrichment::class, 2);
});

it('uses createOrFirst on issue lookups to survive concurrent enrichment races (Codex #5)', function () {
    $project = makeFixesProject();
    $enrichment = app(RecordEnrichmentService::class);

    $record = Record::create([
        'project_id' => $project->id,
        'type' => 'exception',
        'fingerprint' => md5('Same\\Class:boom'),
        'payload' => [
            'class' => 'Same\\Class',
            'message' => 'boom',
            'file' => '/x.php',
            'line' => 1,
        ],
        'created_at' => now(),
    ]);
    $record2 = Record::create([
        'project_id' => $project->id,
        'type' => 'exception',
        'fingerprint' => md5('Same\\Class:boom'),
        'payload' => [
            'class' => 'Same\\Class',
            'message' => 'boom',
            'file' => '/x.php',
            'line' => 1,
        ],
        'created_at' => now(),
    ]);

    // Simulate two enrichment workers handling the same fingerprint
    // back-to-back. The second call MUST not throw a unique-index
    // violation — createOrFirst lets the second worker find the existing
    // row.
    $enrichment->handleException($project, $record);
    $enrichment->handleException($project, $record2);

    $issues = $project->issues()->get();
    expect($issues)->toHaveCount(1, 'Both calls collapse into a single issue row')
        ->and($issues->first()->occurrences_count)->toBe(2);
});

it('honors LARAOWL_QUEUE_INGEST / LARAOWL_QUEUE_ENRICHMENT config keys for job routing (Codex round-2 #2)', function () {
    config([
        'laraowl.queues.ingest' => 'custom-laraowl-ingest',
        'laraowl.queues.enrichment' => 'custom-laraowl-enrichment',
    ]);

    $project = makeFixesProject();

    $ingestJob = new ProcessIngestedRecords($project, []);
    expect($ingestJob->queue)->toBe('custom-laraowl-ingest');

    $enrichmentJob = new ProcessRecordEnrichment(1, 1, 'request');
    expect($enrichmentJob->queue)->toBe('custom-laraowl-enrichment');
});

it('honors LARAOWL_BROADCAST_THROTTLE_SEC from the real config file (Codex #6)', function () {
    // The new config/laraowl.php publishes this key from the env var.
    expect(config('laraowl.broadcast_throttle_sec'))->toBe(1);

    // Override to a high value at runtime and prove ingest respects it.
    config(['laraowl.broadcast_throttle_sec' => 30]);

    Event::fake([ProjectDataIngested::class]);

    $project = makeFixesProject();
    $payload = ['records' => [['t' => 'query', 'sql' => 'select 1']]];
    $headers = ['X-Laraowl-Token' => $project->api_token];

    $this->withHeaders($headers)->postJson('/api/records', $payload);
    $this->withHeaders($headers)->postJson('/api/records', $payload);

    Event::assertDispatchedTimes(ProjectDataIngested::class, 1);
});
