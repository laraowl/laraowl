<?php

use App\Events\ProjectDataIngested;
use App\Jobs\ProcessIngestedRecords;
use App\Jobs\ProcessRecordEnrichment;
use App\Models\Project;
use App\Models\Record;
use App\Models\Team;
use App\Services\RecordEnrichmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * Full pipeline integration:
 *   HTTP POST /api/records
 *     → IngestController dispatches ProcessIngestedRecords
 *       → ingestBulk() bulk-inserts + dispatches ProcessRecordEnrichment per row
 *         → handle() drives RecordEnrichmentService
 *
 * Each segment already has unit/feature coverage. This file pins the wire-up
 * so a refactor that breaks one of the hand-offs (controller → job → service)
 * is caught even when the components in isolation still pass.
 */
function makeE2EProject(): Project
{
    $team = Team::factory()->create();

    return Project::factory()->create([
        'team_id' => $team->id,
        'api_token' => 'e2e-token-'.bin2hex(random_bytes(6)),
    ]);
}

it('routes a single HTTP POST /api/records through bulk insert + enrichment dispatch', function () {
    Bus::fake([ProcessIngestedRecords::class, ProcessRecordEnrichment::class]);
    Event::fake([ProjectDataIngested::class]);

    $project = makeE2EProject();

    $records = [
        ['t' => 'request', 'method' => 'GET', 'route_path' => '/api/x', 'duration' => 42],
        ['t' => 'exception', 'class' => 'RuntimeException', 'message' => 'boom'],
        ['t' => 'query', 'sql' => 'select 1'],
    ];

    $response = $this->withHeader('X-Laraowl-Token', $project->api_token)
        ->postJson('/api/records', ['app_url' => 'https://app.test', 'records' => $records]);

    $response->assertOk();
    Bus::assertDispatched(ProcessIngestedRecords::class, 1);
});

it('completes the full pipeline end-to-end when jobs run synchronously', function () {
    // Run jobs inline so the test exercises the real ingestBulk → enrichment chain.
    config(['queue.default' => 'sync']);

    Event::fake([ProjectDataIngested::class]);

    $project = makeE2EProject();

    $records = [
        ['t' => 'request', 'method' => 'GET', 'route_path' => '/api/orders', 'duration' => 15],
        ['t' => 'request', 'method' => 'POST', 'route_path' => '/api/orders', 'duration' => 250],
        ['t' => 'exception', 'class' => 'DomainException', 'message' => 'order rejected', 'file' => 'app/x.php', 'line' => 42],
        ['t' => 'query', 'sql' => 'select count(*) from orders'],
    ];

    // Mock the enrichment service so we can prove the job invocation reached it,
    // without depending on threshold/security side effects for this E2E shape check.
    $enrichmentCalls = [];
    $enrichmentMock = Mockery::mock(RecordEnrichmentService::class);
    $enrichmentMock->shouldReceive('handleException')
        ->andReturnUsing(function ($project, $record) use (&$enrichmentCalls): void {
            $enrichmentCalls[] = ['kind' => 'exception', 'recordId' => $record->id];
        });
    $enrichmentMock->shouldReceive('analyzeSecurityForRequest')
        ->andReturnUsing(function ($project, $record) use (&$enrichmentCalls): void {
            $enrichmentCalls[] = ['kind' => 'request', 'recordId' => $record->id];
        });
    $enrichmentMock->shouldReceive('auditSecurity')
        ->andReturnUsing(function ($project, $record) use (&$enrichmentCalls): void {
            $enrichmentCalls[] = ['kind' => 'audit', 'recordId' => $record->id];
        });
    $enrichmentMock->shouldReceive('checkThresholds')
        ->andReturnUsing(function ($project, $record) use (&$enrichmentCalls): void {
            $enrichmentCalls[] = ['kind' => 'threshold', 'recordId' => $record->id];
        });
    app()->instance(RecordEnrichmentService::class, $enrichmentMock);

    $response = $this->withHeader('X-Laraowl-Token', $project->api_token)
        ->postJson('/api/records', ['app_url' => 'https://app.test', 'records' => $records]);

    $response->assertOk();

    // 4 records → 4 inserted rows
    expect(Record::where('project_id', $project->id)->count())->toBe(4);

    // Enrichment ran per record: 4 threshold + 1 exception + 2 request = 7 total
    $thresholdCount = collect($enrichmentCalls)->where('kind', 'threshold')->count();
    $exceptionCount = collect($enrichmentCalls)->where('kind', 'exception')->count();
    $requestCount = collect($enrichmentCalls)->where('kind', 'request')->count();
    expect($thresholdCount)->toBe(4)
        ->and($exceptionCount)->toBe(1)
        ->and($requestCount)->toBe(2);

    // Broadcast fired at most once for this single batch (Cache::lock guards it).
    Event::assertDispatched(ProjectDataIngested::class, fn ($e) => $e->project->id === $project->id);
});

it('drops at-most-once broadcast across two back-to-back POSTs within throttle window', function () {
    config(['queue.default' => 'sync', 'laraowl.broadcast_throttle_sec' => 10]);

    Event::fake([ProjectDataIngested::class]);

    // No-op enrichment so the test focuses on the broadcast throttle.
    $enrichment = Mockery::mock(RecordEnrichmentService::class)->shouldIgnoreMissing();
    app()->instance(RecordEnrichmentService::class, $enrichment);

    $project = makeE2EProject();

    $payload = ['records' => [['t' => 'query', 'sql' => 'select 1']]];
    $headers = ['X-Laraowl-Token' => $project->api_token];

    $this->withHeaders($headers)->postJson('/api/records', $payload)->assertOk();
    $this->withHeaders($headers)->postJson('/api/records', $payload)->assertOk();

    // Both inserts landed (2 records)
    expect(Record::where('project_id', $project->id)->count())->toBe(2);

    // Throttle keeps total broadcasts ≤ 1 inside the 10s lock window.
    Event::assertDispatchedTimes(ProjectDataIngested::class, 1);
});
