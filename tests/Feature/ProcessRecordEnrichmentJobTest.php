<?php

use App\Jobs\ProcessRecordEnrichment;
use App\Models\Project;
use App\Models\Record;
use App\Models\Team;
use App\Services\RecordEnrichmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;

uses(RefreshDatabase::class);

/**
 * Helper: build a real Project + Record pair backed by the test DB so the job's
 * `Project::find()` / `Record::find()` calls succeed. Returns [$project, $record].
 *
 * @return array{0: Project, 1: Record}
 */
function makeProjectAndRecord(string $type = 'request'): array
{
    $team = Team::factory()->create();
    $project = Project::factory()->create(['team_id' => $team->id]);

    // FIXME(A9): if the records table later requires extra columns, top this up
    // with whatever defaults the migration enforces.
    $record = Record::create([
        'project_id' => $project->id,
        'type' => $type,
        'payload' => ['t' => $type, 'path' => '/x', 'duration' => 10],
        'fingerprint' => 'fp-'.$type,
        'created_at' => now(),
    ]);

    return [$project, $record];
}

/**
 * Helper: install a fresh Mockery mock of RecordEnrichmentService in the
 * container so we can drive expectations per test.
 */
function mockEnrichment(): MockInterface
{
    $mock = Mockery::mock(RecordEnrichmentService::class);
    app()->instance(RecordEnrichmentService::class, $mock);

    return $mock;
}

it("dispatches handleException + checkThresholds when type is 'exception'", function (): void {
    [$project, $record] = makeProjectAndRecord('exception');

    $mock = mockEnrichment();
    $mock->shouldReceive('handleException')
        ->once()
        ->with(
            Mockery::on(fn (Project $p): bool => $p->id === $project->id),
            Mockery::on(fn (Record $r): bool => $r->id === $record->id),
        );
    $mock->shouldReceive('checkThresholds')
        ->once()
        ->with(
            Mockery::on(fn (Project $p): bool => $p->id === $project->id),
            Mockery::on(fn (Record $r): bool => $r->id === $record->id),
        );
    $mock->shouldNotReceive('analyzeSecurityForRequest');
    $mock->shouldNotReceive('auditSecurity');

    (new ProcessRecordEnrichment($project->id, $record->id, 'exception'))->handle($mock);
});

it("dispatches analyzeSecurityForRequest + checkThresholds when type is 'request'", function (): void {
    [$project, $record] = makeProjectAndRecord('request');

    $mock = mockEnrichment();
    $mock->shouldReceive('analyzeSecurityForRequest')
        ->once()
        ->with(
            Mockery::on(fn (Project $p): bool => $p->id === $project->id),
            Mockery::on(fn (Record $r): bool => $r->id === $record->id),
        );
    $mock->shouldReceive('checkThresholds')->once();
    $mock->shouldNotReceive('handleException');
    $mock->shouldNotReceive('auditSecurity');

    (new ProcessRecordEnrichment($project->id, $record->id, 'request'))->handle($mock);
});

it("dispatches auditSecurity + checkThresholds when type is 'security-audit'", function (): void {
    [$project, $record] = makeProjectAndRecord('security-audit');

    $mock = mockEnrichment();
    $mock->shouldReceive('auditSecurity')
        ->once()
        ->with(
            Mockery::on(fn (Project $p): bool => $p->id === $project->id),
            Mockery::on(fn (Record $r): bool => $r->id === $record->id),
        );
    $mock->shouldReceive('checkThresholds')->once();
    $mock->shouldNotReceive('handleException');
    $mock->shouldNotReceive('analyzeSecurityForRequest');

    (new ProcessRecordEnrichment($project->id, $record->id, 'security-audit'))->handle($mock);
});

it('only calls checkThresholds for unknown record types', function (): void {
    [$project, $record] = makeProjectAndRecord('query');

    $mock = mockEnrichment();
    $mock->shouldReceive('checkThresholds')->once();
    $mock->shouldNotReceive('handleException');
    $mock->shouldNotReceive('analyzeSecurityForRequest');
    $mock->shouldNotReceive('auditSecurity');

    (new ProcessRecordEnrichment($project->id, $record->id, 'query'))->handle($mock);
});

it('returns silently when project no longer exists', function (): void {
    [$project, $record] = makeProjectAndRecord('exception');
    $missingProjectId = $project->id + 9999;

    $mock = mockEnrichment();
    $mock->shouldNotReceive('handleException');
    $mock->shouldNotReceive('analyzeSecurityForRequest');
    $mock->shouldNotReceive('auditSecurity');
    $mock->shouldNotReceive('checkThresholds');

    (new ProcessRecordEnrichment($missingProjectId, $record->id, 'exception'))->handle($mock);

    // Reaching this line without an exception is the assertion.
    expect(true)->toBeTrue();
});

it('returns silently when record no longer exists', function (): void {
    [$project, $record] = makeProjectAndRecord('request');
    $missingRecordId = $record->id + 9999;

    $mock = mockEnrichment();
    $mock->shouldNotReceive('handleException');
    $mock->shouldNotReceive('analyzeSecurityForRequest');
    $mock->shouldNotReceive('auditSecurity');
    $mock->shouldNotReceive('checkThresholds');

    (new ProcessRecordEnrichment($project->id, $missingRecordId, 'request'))->handle($mock);

    expect(true)->toBeTrue();
});
