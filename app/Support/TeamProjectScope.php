<?php

namespace App\Support;

use App\Models\Team;

/**
 * The "All" pseudo-application: a {@see ProjectContext} spanning every
 * project belonging to a team, selected via the reserved `all` project slug.
 */
final class TeamProjectScope implements ProjectContext
{
    public const SLUG = 'all';

    /** @var array<int, int> */
    private array $projectIds;

    public function __construct(public readonly Team $team)
    {
        $this->projectIds = $team->projects()->pluck('id')->all();
    }

    public function projectIds(): array
    {
        return $this->projectIds;
    }

    public function isAggregate(): bool
    {
        return true;
    }

    public function contextLabel(): string
    {
        return 'All';
    }

    public function contextSlug(): string
    {
        return self::SLUG;
    }
}
