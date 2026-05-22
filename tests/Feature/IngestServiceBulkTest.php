<?php

use App\Events\ProjectDataIngested;
use App\Jobs\ProcessRecordEnrichment;
use App\Models\Heartbeat;
use App\Models\Project;
use App\Models\Record;
use App\Models\Team;
use App\Services\IngestService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

/**
 * Build a project with its team, suitable for ingest assertions.
 *
 * FIXME(A7): Project::factory()/Team::factory() are assumed to provide all
 * required columns. If migrations add NOT NULL fields without defaults this
 * helper will need to set them explicitly.
 */
function makeBulkTestProject(): Project
{
    $team = Team::factory()->create();

    return Project::factory()->create(['team_id' => $team->id]);
}

/**
 * Use a fresh reflection-friendly call to calculateFingerprint() so the test
 * exercises the same hashing the service uses internally. Keeps the test
 * decoupled from md5 details — if the algorithm changes, both sides change.
 */
function fingerprintFor(IngestService $svc, string $type, array $payload): ?string
{
    $method = (new ReflectionClass($svc))->getMethod('calculateFingerprint');
    $method->setAccessible(true);

    return $method->invoke($svc, $type, $payload);
}

it('writes a single INSERT for a batch of non-heartbeat records', function () {
    // Ensure throttle slot is free so the broadcast lock does not interfere.
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $records = [
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/a', 'duration' => 12],
        ['t' => 'request', 'method' => 'POST', 'path' => '/api/b', 'duration' => 22],
        ['t' => 'query', 'sql' => 'select * from users'],
        ['t' => 'exception', 'class' => 'RuntimeException', 'message' => 'boom'],
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/c', 'duration' => 8],
    ];

    DB::flushQueryLog();
    DB::enableQueryLog();

    $svc->ingestBulk($project, $records);

    $log = DB::getQueryLog();
    DB::disableQueryLog();

    $inserts = array_filter($log, function (array $entry): bool {
        return (bool) preg_match('/insert\s+into\s+["`]?records["`]?/i', $entry['query'] ?? '');
    });

    expect($inserts)->toHaveCount(1)
        ->and(Record::query()->where('project_id', $project->id)->count())->toBe(5);
});

it('populates fingerprints correctly per record type', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $payloads = [
        'request' => ['t' => 'request', 'method' => 'GET', 'path' => '/api/users'],
        'exception' => ['t' => 'exception', 'class' => 'App\\Exceptions\\Boom', 'message' => 'nope'],
        'query' => ['t' => 'query', 'sql' => 'select count(*) from records'],
    ];

    $svc->ingestBulk($project, array_values($payloads));

    foreach ($payloads as $type => $payload) {
        $expected = fingerprintFor($svc, $type, $payload);

        expect($expected)->not->toBeNull();

        $stored = Record::query()
            ->where('project_id', $project->id)
            ->where('type', $type)
            ->value('fingerprint');

        expect($stored)->toBe($expected);
    }
});

it('skips records that are missing the t discriminator', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $records = [
        [],                                          // no `t` — skip
        ['t' => 'request', 'method' => 'GET'],       // keep
        ['method' => 'POST', 'path' => '/missing-t'], // no `t` — skip
    ];

    $svc->ingestBulk($project, $records);

    expect(Record::query()->where('project_id', $project->id)->count())->toBe(1);
});

it('creates a heartbeat row and updates last_seen_at on a second call', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $svc->ingestBulk($project, [
        ['t' => 'heartbeat', 'slug' => 'queue-worker', 'name' => 'Queue Worker', 'interval' => 5],
    ]);

    $heartbeat = Heartbeat::query()
        ->where('project_id', $project->id)
        ->where('slug', 'queue-worker')
        ->first();

    expect($heartbeat)->not->toBeNull()
        ->and($heartbeat->name)->toBe('Queue Worker')
        ->and($heartbeat->interval_minutes)->toBe(5)
        ->and($heartbeat->last_seen_at)->not->toBeNull();

    $firstSeenAt = $heartbeat->last_seen_at;

    // Advance the clock so the update is observable.
    $this->travel(2)->seconds();

    $svc->ingestBulk($project, [
        ['t' => 'heartbeat', 'slug' => 'queue-worker'],
    ]);

    expect(
        Heartbeat::query()->where('project_id', $project->id)->count()
    )->toBe(1);

    $heartbeat->refresh();
    expect($heartbeat->last_seen_at->greaterThan($firstSeenAt))->toBeTrue();
});

it('dispatches one ProcessRecordEnrichment job per inserted record', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $records = [
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/x'],
        ['t' => 'exception', 'class' => 'E', 'message' => 'oops'],
        ['t' => 'query', 'sql' => 'select 1'],
        ['t' => 'heartbeat', 'slug' => 'cron'], // heartbeat is NOT a record, no job
        [], // skipped, no job
    ];

    $svc->ingestBulk($project, $records);

    // 3 inserted records → 3 jobs.
    Bus::assertDispatchedTimes(ProcessRecordEnrichment::class, 3);

    foreach (['request', 'exception', 'query'] as $expectedType) {
        Bus::assertDispatched(
            ProcessRecordEnrichment::class,
            function (ProcessRecordEnrichment $job) use ($project, $expectedType): bool {
                if ($job->projectId !== $project->id) {
                    return false;
                }
                if ($job->type !== $expectedType) {
                    return false;
                }
                $record = Record::find($job->recordId);

                return $record !== null && $record->type === $expectedType;
            }
        );
    }
});

it('broadcasts ProjectDataIngested exactly once per call', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    $svc->ingestBulk($project, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/one'],
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/two'],
    ]);

    Event::assertDispatchedTimes(ProjectDataIngested::class, 1);
});

it('throttles the broadcast across two back-to-back calls', function () {
    Cache::flush();
    Event::fake([ProjectDataIngested::class]);
    Bus::fake([ProcessRecordEnrichment::class]);

    $project = makeBulkTestProject();
    $svc = app(IngestService::class);

    // Two consecutive calls within the throttle window (default 1s) should
    // produce at most one broadcast — the second call's Cache::lock()->get()
    // must return false while the first lock is still held.
    $svc->ingestBulk($project, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/first'],
    ]);
    $svc->ingestBulk($project, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/api/second'],
    ]);

    $dispatched = 0;
    Event::assertDispatched(
        ProjectDataIngested::class,
        function () use (&$dispatched): bool {
            $dispatched++;

            return true;
        }
    );

    expect($dispatched)->toBeLessThanOrEqual(1);
});
