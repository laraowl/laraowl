<?php

namespace App\Http\Middleware;

use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Services\UpdateService;
use App\Support\TeamProjectScope;
use App\Support\Version;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $user,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'currentTeam' => function () use ($request, $user) {
                $team = $request->route('current_team');
                if ($team instanceof Team) {
                    return $user->toUserTeam($team);
                }
                if (is_string($team)) {
                    $teamModel = Team::where('slug', $team)->first();
                    if ($teamModel) {
                        return $user->toUserTeam($teamModel);
                    }
                }

                return $user?->currentTeam ? $user->toUserTeam($user->currentTeam) : null;
            },
            'teams' => fn () => $user?->toUserTeams(includeCurrent: true) ?? [],
            'projects' => function () use ($user) {
                if (! $user) {
                    return [];
                }

                $teamIds = $user->teams()->pluck('teams.id');

                return Project::whereIn('team_id', $teamIds)
                    ->get(['id', 'team_id', 'name', 'slug']) ?? [];
            },
            'currentProject' => function () use ($request, $user) {
                $teamParam = $request->route('current_team');
                $team = null;
                if ($teamParam instanceof Team) {
                    $team = $teamParam;
                } elseif (is_string($teamParam)) {
                    $team = Team::where('slug', $teamParam)->first();
                }

                $team = $team ?: $user?->currentTeam;

                $projectParam = $request->route('project');

                if ($projectParam === TeamProjectScope::SLUG) {
                    return [
                        'id' => null,
                        'team_id' => $team?->id,
                        'name' => 'All',
                        'slug' => TeamProjectScope::SLUG,
                        'is_aggregate' => true,
                    ];
                }

                if ($projectParam instanceof Project) {
                    return $projectParam;
                }

                if (is_string($projectParam)) {
                    return $team?->projects()->where('slug', $projectParam)->first();
                }

                return $team?->projects()->first();
            },
            'period' => fn () => $request->query('period', '1h'),
            'from' => fn () => $request->query('from'),
            'to' => fn () => $request->query('to'),
            'version' => Version::current(),
            'update' => fn () => $this->pendingUpdate($user),
            'flash' => [
                'mcpToken' => fn () => $request->session()->get('mcpToken'),
            ],
        ];
    }

    /**
     * Get the release this instance should update to, for the operator.
     *
     * Only the instance operator is shown the update banner, since nobody else
     * can act on it. This reads from cache only and never blocks the request.
     *
     * @return array{version: string, name: string, url: string, notes: string|null, publishedAt: string|null}|null
     */
    protected function pendingUpdate(?User $user): ?array
    {
        if (! $user?->isInstanceOperator()) {
            return null;
        }

        return app(UpdateService::class)->pendingUpdate()?->toArray();
    }
}
