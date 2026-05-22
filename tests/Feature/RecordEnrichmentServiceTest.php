<?php

use App\Models\Issue;
use App\Models\Project;
use App\Models\Record;
use App\Models\Team;
use App\Models\Threshold;
use App\Services\AlertService;
use App\Services\RecordEnrichmentService;
use App\Services\SecurityService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Helper: create a project belonging to a fresh team.
 */
function makeEnrichmentTestProject(array $overrides = []): Project
{
    $team = Team::factory()->create();

    return Project::factory()->create(array_merge(['team_id' => $team->id], $overrides));
}

/**
 * Helper: persist a record row using Record::insert so the model bypasses
 * casting/dispatch, mirroring how ingestBulk() writes records before
 * enrichment runs.
 */
function makeRecord(Project $project, string $type, array $payload): Record
{
    Record::insert([
        'project_id' => $project->id,
        'type' => $type,
        'payload' => json_encode($payload),
        'fingerprint' => md5($type.json_encode($payload)),
        'created_at' => now(),
    ]);

    return Record::query()
        ->where('project_id', $project->id)
        ->latest('id')
        ->first();
}

it('creates a new Issue when handling an exception with no prior matching hash', function () {
    $project = makeEnrichmentTestProject();
    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    // Allow notifyNewIssue (issue is newly created) but spike threshold is high
    // so notifyErrorSpike must NOT fire here.
    $alerts->shouldReceive('notifyNewIssue')->once();
    $alerts->shouldNotReceive('notifyErrorSpike');

    $payload = [
        't' => 'exception',
        'class' => 'RuntimeException',
        'message' => 'Boom went the dynamite',
        'file' => '/app/Foo.php',
        'line' => 42,
    ];
    $record = makeRecord($project, 'exception', $payload);

    $service = new RecordEnrichmentService($alerts, $security);
    $service->handleException($project, $record);

    expect(Issue::query()->count())->toBe(1);

    $this->assertDatabaseHas('issues', [
        'project_id' => $project->id,
        'title' => 'RuntimeException',
        'message' => 'Boom went the dynamite',
        'status' => 'open',
        'occurrences_count' => 1,
    ]);

    // Record should now be linked to the issue.
    $issue = Issue::query()->first();
    expect($record->fresh()->issue_id)->toBe($issue->id);
});

it('increments occurrences_count when handleException matches an existing issue hash', function () {
    $project = makeEnrichmentTestProject();
    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    // First call creates the issue (notifyNewIssue fires once). Second call
    // hits the existing-issue branch so notifyNewIssue must NOT fire again.
    $alerts->shouldReceive('notifyNewIssue')->once();
    $alerts->shouldNotReceive('notifyErrorSpike');

    $payload = [
        't' => 'exception',
        'class' => 'LogicException',
        'message' => 'Repeat offender',
        'file' => '/app/Bar.php',
        'line' => 99,
    ];

    $service = new RecordEnrichmentService($alerts, $security);

    $service->handleException($project, makeRecord($project, 'exception', $payload));
    $beforeSecond = now()->subSecond();

    $service->handleException($project, makeRecord($project, 'exception', $payload));

    expect(Issue::query()->count())->toBe(1);

    $issue = Issue::query()->first();
    expect($issue->occurrences_count)->toBe(2)
        ->and($issue->last_seen_at->greaterThanOrEqualTo($beforeSecond))->toBeTrue();
});

it('triggers an error-spike notification when count exceeds the configured threshold', function () {
    // Lower the spike threshold via project settings so this test stays fast.
    $project = makeEnrichmentTestProject([
        'settings' => [
            'spike_window' => 5,
            'spike_threshold' => 3,
        ],
    ]);

    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    // Three new-issue notifications (one per unique hash). The third call
    // pushes the rolling window count to 3 and must trigger a spike alert.
    $alerts->shouldReceive('notifyNewIssue')->times(3);
    $alerts->shouldReceive('notifyErrorSpike')
        ->once()
        ->with(Mockery::on(fn ($arg) => $arg instanceof Project && $arg->id === $project->id), 3, 5);

    $service = new RecordEnrichmentService($alerts, $security);

    foreach (range(1, 3) as $i) {
        $record = makeRecord($project, 'exception', [
            't' => 'exception',
            'class' => "Spike{$i}Exception",
            'message' => "Spike message {$i}",
            'file' => "/app/Spike{$i}.php",
            'line' => $i,
        ]);
        $service->handleException($project, $record);
    }

    // Spike timestamp persisted on the project settings payload.
    expect($project->fresh()->settings['last_spike_alert_at'] ?? null)->not->toBeNull();
});

it('treats checkThresholds as a no-op when the record payload has no duration', function () {
    $project = makeEnrichmentTestProject();
    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    // No alert or issue should be produced when duration is missing.
    $alerts->shouldNotReceive('notifySlowPerformance');

    $record = makeRecord($project, 'request', [
        't' => 'request',
        'method' => 'GET',
        'path' => '/api/no-duration',
    ]);

    $service = new RecordEnrichmentService($alerts, $security);
    $service->checkThresholds($project, $record);

    expect(Issue::query()->count())->toBe(0);
});

it('creates a slow-performance Issue when duration exceeds the project threshold', function () {
    $project = makeEnrichmentTestProject();

    Threshold::create([
        'project_id' => $project->id,
        'type' => 'route',
        'key' => '/api/slow',
        'value' => 200,
        'is_enabled' => true,
    ]);

    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    $alerts->shouldReceive('notifySlowPerformance')
        ->once()
        ->with(Mockery::type(Issue::class));

    $record = makeRecord($project, 'request', [
        't' => 'request',
        'method' => 'GET',
        'path' => '/api/slow',
        'duration' => 750,
    ]);

    $service = new RecordEnrichmentService($alerts, $security);
    $service->checkThresholds($project, $record);

    $this->assertDatabaseHas('issues', [
        'project_id' => $project->id,
        'title' => 'Slow Route: /api/slow',
        'status' => 'open',
    ]);

    $issue = Issue::query()->where('project_id', $project->id)->first();
    expect($issue->message)->toContain('Duration: 750ms')
        ->and($issue->message)->toContain('Threshold: 200ms')
        ->and($record->fresh()->issue_id)->toBe($issue->id);
});

it('delegates analyzeSecurityForRequest to SecurityService::analyze', function () {
    $project = makeEnrichmentTestProject();
    $record = makeRecord($project, 'request', [
        't' => 'request',
        'method' => 'POST',
        'path' => '/api/audit',
    ]);

    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    $security->shouldReceive('analyze')
        ->once()
        ->with(
            Mockery::on(fn ($arg) => $arg instanceof Project && $arg->id === $project->id),
            Mockery::on(fn ($arg) => $arg instanceof Record && $arg->id === $record->id),
        );
    $security->shouldNotReceive('audit');

    $service = new RecordEnrichmentService($alerts, $security);
    $service->analyzeSecurityForRequest($project, $record);
});

it('delegates auditSecurity to SecurityService::audit', function () {
    $project = makeEnrichmentTestProject();
    $record = makeRecord($project, 'security-audit', [
        't' => 'security-audit',
        'finding' => 'open-port',
    ]);

    $alerts = Mockery::mock(AlertService::class);
    $security = Mockery::mock(SecurityService::class);

    $security->shouldReceive('audit')
        ->once()
        ->with(
            Mockery::on(fn ($arg) => $arg instanceof Project && $arg->id === $project->id),
            Mockery::on(fn ($arg) => $arg instanceof Record && $arg->id === $record->id),
        );
    $security->shouldNotReceive('analyze');

    $service = new RecordEnrichmentService($alerts, $security);
    $service->auditSecurity($project, $record);
});
