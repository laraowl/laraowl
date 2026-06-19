<?php

namespace App\Http\Controllers\Projects;

use App\Http\Controllers\Controller;
use App\Models\Integration;
use App\Models\Project;
use App\Models\Team;
use App\Services\IntegrationService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IntegrationController extends Controller
{
    public function index(Request $request, Team $current_team, Project $project, IntegrationService $service)
    {
        return Inertia::render('projects/settings/index', [
            'project' => $project->makeVisible(['api_token'])->load(['integrations', 'alertRules.integrations', 'thresholds']),
            'integrations' => $project->integrations,
            'alert_rules' => $project->alertRules,
            'available_types' => $service->getAvailableTypes(),
            'team_members' => $current_team->users,
        ]);
    }

    public function store(Request $request, Team $current_team, Project $project)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'in:slack,discord,telegram,webhook,email,gotify'],
            'data' => ['required', 'array'],
        ]);

        $integration = $project->integrations()->create([
            'name' => $request->name,
            'type' => $request->type,
            'data' => $request->data,
            'is_enabled' => true,
        ]);

        // Automatically attach to all existing alert rules for ease of use
        $rules = $project->alertRules()->get();
        foreach ($rules as $rule) {
            $rule->integrations()->attach($integration->id);
        }

        return back()->with('success', 'Integration added successfully.');
    }

    public function update(Request $request, Team $current_team, Project $project, Integration $integration)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'is_enabled' => ['required', 'boolean'],
            'data' => ['required', 'array'],
        ]);

        $integration->update([
            'name' => $request->name,
            'is_enabled' => $request->is_enabled,
            'data' => $request->data,
        ]);

        return back()->with('success', 'Integration updated successfully.');
    }

    public function destroy(Team $current_team, Project $project, Integration $integration)
    {
        $integration->delete();

        return back()->with('success', 'Integration removed successfully.');
    }

    public function test(Request $request, Team $current_team, Project $project, Integration $integration)
    {
        try {
            app(IntegrationService::class)->send(
                $integration,
                '✅ Test Connection',
                'This is a test notification from Laraowl to verify your integration settings.'
            );

            return back()->with('success', 'Test notification sent successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['integration' => 'Failed to send test: '.$e->getMessage()]);
        }
    }
}
