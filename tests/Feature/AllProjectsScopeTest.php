<?php

use App\Enums\TeamRole;
use App\Models\Issue;
use App\Models\Project;
use App\Models\RecordRollup;
use App\Models\Team;
use App\Models\User;
use App\Support\TeamProjectScope;
use Illuminate\Support\Str;

test('a team member views the aggregate dashboard, uptime, issues and requests screens', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    $olderCheck = now()->subHours(3);
    $up = Project::factory()->create(['team_id' => $team->id, 'last_uptime_status' => 'up', 'last_uptime_check_at' => now()]);
    $down = Project::factory()->create(['team_id' => $team->id, 'last_uptime_status' => 'down', 'last_uptime_check_at' => $olderCheck]);

    RecordRollup::create([
        'project_id' => $up->id,
        'type' => 'request',
        'bucket' => now(),
        'count' => 10,
        'ok_count' => 10,
        'sum_duration' => 1000,
        'count_duration' => 10,
        'max_duration' => 500,
        'min_duration' => 10,
    ]);
    RecordRollup::create([
        'project_id' => $down->id,
        'type' => 'request',
        'bucket' => now(),
        'count' => 5,
        'ok_count' => 5,
        'sum_duration' => 500,
        'count_duration' => 5,
        'max_duration' => 300,
        'min_duration' => 20,
    ]);

    $up->uptimeChecks()->create(['status' => 'up', 'response_time' => 100, 'status_code' => 200, 'checked_at' => now()]);
    $down->uptimeChecks()->create(['status' => 'down', 'response_time' => null, 'status_code' => null, 'error' => 'timeout', 'checked_at' => $olderCheck]);

    $this->actingAs($user);

    $this->get(route('dashboard', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('dashboard/index')
            ->where('total_requests', 15)
            // Mixed statuses collapse to 'down' so the existing card needs no changes.
            ->where('uptime_status.current', 'down')
            ->where('uptime_status.up', 1)
            ->where('uptime_status.down', 1)
            ->where('uptime_status.total', 2)
            // The oldest (most overdue) check across every project, not the newest.
            ->where('uptime_status.last_check', $olderCheck->toIso8601String())
        );

    $this->get(route('uptime', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/uptime/index')
            ->where('uptime_stats.total_checks', 2)
            ->where('uptime_stats.uptime_percentage', 50)
        );

    $this->get(route('issues', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('projects/issues/index'));

    $this->get(route('requests', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/requests/index')
            ->where('overview.ok', 15)
        );
});

test('management and settings routes 404 under the aggregate scope', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
    Project::factory()->create(['team_id' => $team->id]);

    $this->actingAs($user);

    $this->get(route('firewall.overview', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertNotFound();

    $this->get(route('project.settings', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertNotFound();

    $this->patch(route('projects.update', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]), ['name' => 'x'])
        ->assertNotFound();
});

test('drill-down detail routes merge matching records across projects under the aggregate scope', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    $projectA = Project::factory()->create(['team_id' => $team->id]);
    $projectB = Project::factory()->create(['team_id' => $team->id]);

    // Same method+path fingerprints identically regardless of project, so
    // this lands both records under the same hash — matching how the list
    // page already merges rows by hash across projects (see groupList()).
    $this->travelTo(now()->subMinute());
    app(\App\Services\IngestService::class)->ingest($projectA, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/health', 'status_code' => 200],
    ]);
    $this->travelBack();
    app(\App\Services\IngestService::class)->ingest($projectB, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/health', 'status_code' => 200],
    ]);

    $hash = \App\Models\Record::where('project_id', $projectA->id)->where('type', 'request')->value('fingerprint');

    $this->actingAs($user)
        ->get(route('requests.show', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG, 'hash' => $hash]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/requests/show')
            ->has('records.data', 2)
            // Newest first: projectB was ingested after projectA.
            ->where('records.data.0.project.slug', $projectB->slug)
            ->where('records.data.1.project.slug', $projectA->slug)
        );
});

test('management and detail routes for a real project are unaffected by the aggregate scope', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
    $project = Project::factory()->create(['team_id' => $team->id]);

    app(\App\Services\IngestService::class)->ingest($project, [
        ['t' => 'request', 'method' => 'GET', 'path' => '/health', 'status_code' => 200],
    ]);
    $hash = \App\Models\Record::where('project_id', $project->id)->where('type', 'request')->value('fingerprint');

    $this->actingAs($user)
        ->get(route('requests.show', ['current_team' => $team->slug, 'project' => $project->slug, 'hash' => $hash]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page->has('records.data', 1));
});

test('an issue listed in the aggregate scope carries its own project and links back to it', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    $project = Project::factory()->create(['team_id' => $team->id]);

    Issue::create([
        'project_id' => $project->id,
        'hash' => 'hash-1',
        'type' => 'exception',
        'title' => 'Something broke',
        'message' => 'It broke.',
        'status' => 'open',
        'priority' => 'high',
        'occurrences_count' => 1,
        'first_seen_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($user)
        ->get(route('issues', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('projects/issues/index')
            ->where('issues.data.0.project.slug', $project->slug)
        );
});

test('a project can never be created with the reserved aggregate slug', function () {
    $team = Team::factory()->create();

    $project = $team->projects()->create([
        'name' => 'All',
        'api_token' => Str::random(32),
    ]);

    expect($project->slug)->not->toBe(TeamProjectScope::SLUG)
        ->and($project->slug)->toBe('all-1');
});

test('the aggregate dashboard does not blow up for a team with no projects', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    $this->actingAs($user)
        ->get(route('dashboard', ['current_team' => $team->slug, 'project' => TeamProjectScope::SLUG]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('dashboard/index')
            ->where('total_requests', 0)
            ->where('uptime_status.current', 'unknown')
        );
});
