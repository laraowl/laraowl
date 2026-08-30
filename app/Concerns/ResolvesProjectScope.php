<?php

namespace App\Concerns;

use App\Models\Team;
use App\Support\ProjectContext;
use App\Support\TeamProjectScope;

/**
 * Resolves the `{project}` route segment into either a real project or the
 * `TeamProjectScope::SLUG` ("All") aggregate scope. Used by the listing
 * controllers whose screens are reused for the aggregate view.
 */
trait ResolvesProjectScope
{
    protected function resolveProjectScope(Team $team, string $projectParam): ProjectContext
    {
        if ($projectParam === TeamProjectScope::SLUG) {
            return new TeamProjectScope($team);
        }

        return $team->projects()->where('slug', $projectParam)->firstOrFail();
    }
}
