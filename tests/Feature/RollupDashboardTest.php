<?php

use App\Models\Project;
use App\Services\IngestService;
use App\Services\RecordService;

function ingestBatch(Project $project, array $records): void
{
    app(IngestService::class)->ingest($project, $records);
}

function records(): RecordService
{
    return app(RecordService::class);
}

test('quick stats are counted from the rollups in a single grouped read', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200],
        ['t' => 'request', 'status_code' => 200],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
        ['t' => 'queued-job', 'name' => 'J'],
        ['t' => 'job-attempt', 'name' => 'J', 'status' => 'processed'],
        ['t' => 'log', 'level' => 'info'],
    ]);

    $stats = records()->getQuickStats($project, '1h');

    expect($stats['requests'])->toBe(2)
        ->and($stats['exceptions'])->toBe(1)
        ->and($stats['logs'])->toBe(1)
        ->and($stats['jobs'])->toBe(2)
        // The key is naively pluralised as "query" + "s"; the frontend relies
        // on it, so it stays.
        ->and($stats['querys'])->toBe(0);
});

test('dashboard totals and breakdowns come from the rollups', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 10, 'user' => '1'],
        ['t' => 'request', 'status_code' => 404, 'duration' => 20, 'user' => '2'],
        ['t' => 'request', 'status_code' => 500, 'duration' => 60],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
    ]);

    $stats = records()->getDashboardStats($project, '1h');

    expect($stats['total_requests'])->toBe(3)
        ->and($stats['request_breakdown'])->toMatchArray([
            'ok' => 1,
            'client_error' => 1,
            'server_error' => 1,
        ])
        ->and($stats['duration_stats']['avg'])->toBe(30.0)
        ->and($stats['duration_stats']['max'])->toBe(60.0)
        ->and($stats['duration_stats']['min'])->toBe(10.0)
        ->and($stats['total_exceptions'])->toBe(1)
        ->and($stats['auth_users_count'])->toBe(2)
        ->and($stats['guest_users_count'])->toBe(1);
});

test('a single project always counts as one service in the uptime status', function () {
    $up = Project::factory()->create(['last_uptime_status' => 'up']);
    $down = Project::factory()->create(['last_uptime_status' => 'down']);
    $unchecked = Project::factory()->create(['last_uptime_status' => null]);

    expect(records()->getDashboardStats($up, '1h')['uptime_status'])->toMatchArray([
        'current' => 'up', 'up' => 1, 'down' => 0, 'total' => 1,
    ]);

    expect(records()->getDashboardStats($down, '1h')['uptime_status'])->toMatchArray([
        'current' => 'down', 'up' => 0, 'down' => 1, 'total' => 1,
    ]);

    expect(records()->getDashboardStats($unchecked, '1h')['uptime_status'])->toMatchArray([
        'current' => 'unknown', 'up' => 0, 'down' => 0, 'total' => 1,
    ]);
});

test('a user seen across several hours is counted once over the period', function () {
    $project = Project::factory()->create();

    $this->travelTo(now()->subHours(5)->startOfHour());
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => '7']]);

    $this->travelTo(now()->addHours(2));
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => '7']]);
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => '8']]);

    $this->travelBack();

    $stats = records()->getDashboardStats($project, '24h');

    // Distinct counts are not additive; summing per-bucket counts would give 3.
    expect($stats['auth_users_count'])->toBe(2)
        ->and($stats['total_requests'])->toBe(3)
        ->and($project->userBuckets()->count())->toBe(3);
});

test('user buckets are hourly, not minutely', function () {
    $project = Project::factory()->create();

    $this->travelTo(now()->startOfHour()->addMinutes(5));
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => '7']]);

    $this->travelTo(now()->addMinutes(20));
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => '7']]);

    $this->travelBack();

    // Two different minutes, one hour: a minute-granular table stored 914k rows
    // for a million records, which was 94% of the dashboard's query time.
    $buckets = $project->userBuckets()->where('type', 'request')->get();

    expect($buckets)->toHaveCount(1)
        ->and((int) $buckets->first()->count)->toBe(2)
        ->and($buckets->first()->bucket->format('i:s'))->toBe('00:00');
});

test('the same user in one bucket is stored once', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'user' => '7'],
        ['t' => 'request', 'status_code' => 200, 'user' => '7'],
    ]);

    expect($project->userBuckets()->where('type', 'request')->count())->toBe(1);
});

test('a guest id from the client is not treated as an authenticated user', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'user' => '42'],
        ['t' => 'request', 'status_code' => 200, 'user' => 'guest_de7fc5f313ff'],
        ['t' => 'request', 'status_code' => 200, 'user' => 'guest_de7fc5f313ff'],
        ['t' => 'request', 'status_code' => 200, 'user' => 'guest_aab3238922bc'],
    ]);

    $stats = records()->getDashboardStats($project, '1h');

    // The client sends `guest_<hash>` rather than null for anonymous visitors.
    // Counting those as people made guest_users_count zero and let a handful of
    // guest hashes fill the top-user panel.
    expect($stats['auth_users_count'])->toBe(1)
        ->and($stats['guest_users_count'])->toBe(3)
        ->and($stats['active_users'])->toHaveCount(1)
        ->and($stats['active_users']->first()->user_id)->toBe('42')
        ->and($project->userBuckets()->count())->toBe(1);
});

test('the time series is bucketed and gap filled from the rollups', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 10, 'user' => '1'],
        ['t' => 'request', 'status_code' => 500, 'duration' => 30],
    ]);

    $series = records()->getDashboardStats($project, '1h')['timeSeries'];

    expect($series)->toHaveCount(60);

    $populated = collect($series)->firstWhere('total', 2);

    expect($populated)->not->toBeNull()
        ->and($populated['ok'])->toBe(1)
        ->and($populated['server_error'])->toBe(1)
        ->and($populated['avg_duration'])->toBe(20.0)
        ->and($populated['active_users'])->toBe(1);

    // Every other slot is zero filled, so the chart keeps its shape.
    expect(collect($series)->sum('total'))->toBe(2);
});

test('the exception time series counts exceptions, not requests', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'duration' => 10, 'user' => '1'],
        ['t' => 'request', 'status_code' => 500, 'duration' => 30],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
        ['t' => 'exception', 'class' => 'E', 'message' => 'm'],
    ]);

    $stats = records()->getDashboardStats($project, '1h');

    expect($stats['exceptionTimeSeries'])->toHaveCount(60);

    // The dashboard's request series mixes in the requests above, so its
    // populated slot totals 2 — the exception series must not be that.
    $populated = collect($stats['exceptionTimeSeries'])->firstWhere('total', '>', 0);

    expect($populated)->not->toBeNull()
        ->and($populated['total'])->toBe(3)
        ->and($populated['server_error'])->toBe(3);

    expect(collect($stats['exceptionTimeSeries'])->sum('total'))->toBe(3);
});

test('p95 is read off the histogram instead of being a disguised maximum', function () {
    $project = Project::factory()->create();

    // Durations are microseconds: 95 jobs at 10ms, 5 stragglers at 5s.
    $batch = [];
    for ($i = 0; $i < 95; $i++) {
        $batch[] = ['t' => 'job-attempt', 'name' => 'J', 'status' => 'processed', 'duration' => 10_000];
    }
    for ($i = 0; $i < 5; $i++) {
        $batch[] = ['t' => 'job-attempt', 'name' => 'J', 'status' => 'processed', 'duration' => 5_000_000];
    }

    ingestBatch($project, $batch);

    $jobStats = records()->getDashboardStats($project, '1h')['job_stats'];

    // These fields are divided by 1000 for display, so the units are milliseconds.
    // The old code reported MAX(duration) here, which would have read 5000ms.
    expect($jobStats['p95_duration'])->toBe(10.0)
        ->and($jobStats['avg_duration'])->toBe(259.5)
        ->and($jobStats['total'])->toBe(100)
        ->and($jobStats['processed'])->toBe(100);
});

test('overview cards on the type pages read from the rollups', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'command', 'command' => 'a', 'exit_code' => 0, 'duration' => 10],
        ['t' => 'command', 'command' => 'b', 'exit_code' => 1, 'duration' => 30],
        ['t' => 'cache-event', 'key' => 'k', 'type' => 'hit'],
        ['t' => 'cache-event', 'key' => 'k', 'type' => 'miss'],
    ]);

    expect(records()->getCommandStats($project, '1h')['overview'])->toMatchArray([
        'total' => 2,
        'success' => 1,
        'failed' => 1,
        'avg_duration' => 20.0,
    ]);

    expect(records()->getCacheStats($project, '1h')['overview'])->toMatchArray([
        'total' => 2,
        'hits' => 1,
        'misses' => 1,
        'hit_rate' => 50.0,
    ]);
});

test('a request with a null user counts as a guest, not as a user named null', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'user' => '1'],
        ['t' => 'request', 'status_code' => 200, 'user' => null],
        ['t' => 'request', 'status_code' => 200],
    ]);

    $stats = records()->getDashboardStats($project, '1h');

    // The old SQL asked `JSON_EXTRACT(payload,'$.user') IS NOT NULL`, but a JSON
    // null is not an SQL NULL, so guests were counted as one shared user whose
    // id was the string "null" — and guest_users_count came out as zero.
    expect($stats['auth_users_count'])->toBe(1)
        ->and($stats['guest_users_count'])->toBe(2)
        ->and($stats['active_users'])->toHaveCount(1)
        ->and($stats['active_users']->first()->user_id)->toBe('1');
});

test('the top user panels rank from the user buckets', function () {
    $project = Project::factory()->create();

    $batch = [];
    foreach (['a' => 5, 'b' => 3, 'c' => 1] as $user => $requests) {
        for ($i = 0; $i < $requests; $i++) {
            $batch[] = ['t' => 'request', 'status_code' => 200, 'user' => $user];
        }
    }
    $batch[] = ['t' => 'exception', 'class' => 'E', 'message' => 'm', 'user' => 'b'];
    $batch[] = ['t' => 'exception', 'class' => 'E', 'message' => 'm', 'user' => 'b'];
    $batch[] = ['t' => 'exception', 'class' => 'E', 'message' => 'm', 'user' => 'c'];

    ingestBatch($project, $batch);

    $stats = records()->getDashboardStats($project, '1h');

    $active = $stats['active_users'];
    expect($active)->toHaveCount(3)
        ->and($active->first()->user_id)->toBe('a')
        ->and((int) $active->first()->request_count)->toBe(5);

    $impacted = $stats['impacted_users'];
    expect($impacted->first()->user_id)->toBe('b')
        ->and((int) $impacted->first()->error_count)->toBe(2);
});

test('top user counts survive a second batch in the same bucket', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => 'a']]);
    ingestBatch($project, [['t' => 'request', 'status_code' => 200, 'user' => 'a']]);

    $active = records()->getDashboardStats($project, '1h')['active_users'];

    expect((int) $active->first()->request_count)->toBe(2);
});

test('rollups are scoped to their own project', function () {
    $mine = Project::factory()->create();
    $theirs = Project::factory()->create();

    ingestBatch($mine, [['t' => 'request', 'status_code' => 200]]);
    ingestBatch($theirs, [['t' => 'request', 'status_code' => 200], ['t' => 'request', 'status_code' => 200]]);

    expect(records()->getQuickStats($mine, '1h')['requests'])->toBe(1)
        ->and(records()->getQuickStats($theirs, '1h')['requests'])->toBe(2);
});

test('the time series splits authenticated requests from guest requests per bucket', function () {
    $project = Project::factory()->create();

    ingestBatch($project, [
        ['t' => 'request', 'status_code' => 200, 'user' => '1'],
        ['t' => 'request', 'status_code' => 200, 'user' => '2'],
        ['t' => 'request', 'status_code' => 200],
    ]);

    $series = records()->getDashboardStats($project, '1h')['timeSeries'];

    $populated = collect($series)->firstWhere('total', 3);

    // The legend above the chart reports 2 auth / 1 guest for the period; the
    // bars must be able to reproduce that same split per bucket.
    expect($populated)->not->toBeNull()
        ->and($populated['authed'])->toBe(2)
        ->and($populated['guest'])->toBe(1);

    // Every zero-filled slot must also carry the split keys so the stacked
    // bars don't blow up on undefined values.
    $empty = collect($series)->firstWhere('total', 0);

    expect($empty['authed'])->toBe(0)
        ->and($empty['guest'])->toBe(0);
});
