<?php

namespace App\Http\Middleware;

use App\Models\Project;
use App\Models\Team;
use App\Support\TeamProjectScope;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureProjectExists
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $teamParam = $request->route('current_team');

        // Resolve team from route param (could be slug string or model instance)
        $currentTeam = $teamParam instanceof Team
            ? $teamParam
            : Team::where('slug', $teamParam)->first();

        if (! $user || ! $currentTeam || ! $user->belongsToTeam($currentTeam)) {
            return $next($request);
        }

        $projectParam = $request->route('project');

        // The "All" pseudo-application: let it through untouched. Screens
        // that don't support the aggregate scope still 404 naturally, since
        // no real Project row ever has this slug for implicit binding to match.
        if ($projectParam === TeamProjectScope::SLUG) {
            return $next($request);
        }

        // Resolve project and ensure it belongs to the current team
        $project = $projectParam instanceof Project
            ? $projectParam
            : $currentTeam->projects()->where('slug', $projectParam)->first();

        if ($project) {
            // Share with controllers via request attributes
            $request->attributes->set('current_project', $project);

            return $next($request);
        }

        // Handle missing project context
        return $this->handleMissingProject($request, $currentTeam);
    }

    /**
     * Determine where to redirect if the requested project context is invalid.
     */
    protected function handleMissingProject(Request $request, $currentTeam): Response
    {
        $firstProject = $currentTeam->projects()->first();

        if ($firstProject) {
            $targetUrl = route('dashboard', [
                'current_team' => $currentTeam->slug,
                'project' => $firstProject->slug,
            ]);

            // Avoid infinite redirect loop
            if ($request->fullUrl() === $targetUrl) {
                return abort(404, 'Project context not found.');
            }

            return redirect($targetUrl);
        }

        // If no projects exist at all, force creation
        if (! $request->routeIs('projects.create') && ! $request->routeIs('projects.store')) {
            return redirect()->route('projects.create', ['current_team' => $currentTeam->slug]);
        }

        return $next($request);
    }
}
