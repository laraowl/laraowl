<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\Team;
use App\Services\IntegrationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GotifyIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_sends_a_notification_to_gotify()
    {
        Http::fake();

        $team = Team::factory()->create();
        $project = Project::factory()->create(['team_id' => $team->id]);

        $integration = $project->integrations()->create([
            'name' => 'My Gotify',
            'type' => 'gotify',
            'data' => [
                'server_url' => 'https://gotify.example.com/',
                'app_token' => 'secret-token',
            ],
            'is_enabled' => true,
        ]);

        app(IntegrationService::class)->send(
            $integration,
            '🚨 New Alert',
            'Something broke.',
            ['Project' => 'Demo'],
            'https://laraowl.test/issues/1',
        );

        Http::assertSent(function ($request) {
            return $request->url() === 'https://gotify.example.com/message'
                && $request->hasHeader('X-Gotify-Key', 'secret-token')
                && $request['title'] === '🚨 New Alert'
                && str_contains($request['message'], 'Something broke.')
                && str_contains($request['message'], '**Project:** Demo')
                && $request['priority'] === 5;
        });

        $this->assertEquals('healthy', $integration->fresh()->status);
    }

    public function test_it_does_not_send_when_gotify_config_is_missing()
    {
        Http::fake();

        $team = Team::factory()->create();
        $project = Project::factory()->create(['team_id' => $team->id]);

        $integration = $project->integrations()->create([
            'name' => 'Broken Gotify',
            'type' => 'gotify',
            'data' => ['server_url' => 'https://gotify.example.com'],
            'is_enabled' => true,
        ]);

        app(IntegrationService::class)->send($integration, 'Test', 'Message');

        Http::assertNothingSent();
    }
}
