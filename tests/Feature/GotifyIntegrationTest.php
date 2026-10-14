<?php

use App\Models\Integration;
use App\Models\Project;
use App\Services\IntegrationService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

function createGotifyIntegration(array $data): Integration
{
    return Project::factory()->create()->integrations()->create([
        'name' => 'My Gotify',
        'type' => 'gotify',
        'data' => $data,
        'is_enabled' => true,
    ]);
}

test('it sends a notification to gotify', function () {
    Http::fake();

    $integration = createGotifyIntegration([
        'server_url' => 'https://gotify.example.com/',
        'app_token' => 'secret-token',
    ]);

    app(IntegrationService::class)->send(
        $integration,
        '🚨 New Alert',
        'Something broke.',
        ['Project' => 'Demo', 'Priority' => ''],
        'https://laraowl.test/issues/1',
    );

    Http::assertSent(fn (Request $request) => $request->url() === 'https://gotify.example.com/message'
        && $request->hasHeader('X-Gotify-Key', 'secret-token')
        && $request['title'] === '🚨 New Alert'
        && $request['message'] === "Something broke.\n\n- **Project:** Demo\n\n[View Details](<https://laraowl.test/issues/1>)"
        && $request['priority'] === 5
        && $request['extras'] === [
            'client::display' => ['contentType' => 'text/markdown'],
            'client::notification' => ['click' => ['url' => 'https://laraowl.test/issues/1']],
        ]);

    expect($integration->fresh()->status)->toBe('healthy');
});

test('it does not set a notification click url without a link', function () {
    Http::fake();

    $integration = createGotifyIntegration([
        'server_url' => 'https://gotify.example.com',
        'app_token' => 'secret-token',
    ]);

    app(IntegrationService::class)->send($integration, '✅ Test Connection', 'This is a test notification.');

    Http::assertSent(fn (Request $request) => $request['message'] === 'This is a test notification.'
        && $request['extras'] === ['client::display' => ['contentType' => 'text/markdown']]);
});

test('it does not send when gotify config is missing', function () {
    Http::fake();

    $integration = createGotifyIntegration(['server_url' => 'https://gotify.example.com']);

    app(IntegrationService::class)->send($integration, 'Test', 'Message');

    Http::assertNothingSent();
});

test('it sends the issue priority as the gotify priority', function () {
    Http::fake();

    $integration = createGotifyIntegration([
        'server_url' => 'https://gotify.example.com',
        'app_token' => 'secret-token',
    ]);

    app(IntegrationService::class)->send($integration, '🚨 New Exception', 'Something broke.', ['Priority' => 'HIGH']);

    Http::assertSent(fn (Request $request) => $request['priority'] === 8);
});
