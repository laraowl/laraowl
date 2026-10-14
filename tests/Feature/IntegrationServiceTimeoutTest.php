<?php

use App\Models\Integration;
use App\Models\Project;
use App\Models\Team;
use App\Services\IntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

test('outgoing integration requests are sent with a timeout', function (string $type, array $data) {
    $team = Team::factory()->create();
    $project = Project::factory()->create(['team_id' => $team->id]);
    $integration = Integration::create([
        'project_id' => $project->id,
        'type' => $type,
        'name' => ucfirst($type),
        'data' => $data,
        'is_enabled' => true,
    ]);

    $timeouts = [];

    Http::fake(function (Request $request, array $options) use (&$timeouts) {
        $timeouts[] = $options['timeout'] ?? null;

        return Http::response('ok', 200);
    });

    app(IntegrationService::class)->send($integration, 'Title', 'Message', ['Key' => 'Value'], 'https://laraowl.test');

    expect($timeouts)->toBe([10]);
})->with([
    'slack' => ['slack', ['webhook_url' => 'https://hooks.slack.test/abc']],
    'discord' => ['discord', ['webhook_url' => 'https://discord.test/api/webhooks/abc']],
    'telegram' => ['telegram', ['bot_token' => '123:abc', 'chat_id' => '42']],
    'webhook' => ['webhook', ['url' => 'https://example.test/hook']],
    'gotify' => ['gotify', ['server_url' => 'https://gotify.test', 'app_token' => 'abc']],
]);
