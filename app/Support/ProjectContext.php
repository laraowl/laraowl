<?php

namespace App\Support;

/**
 * A scope that stats/records can be filtered by: either a single real
 * {@see \App\Models\Project} or an aggregate {@see TeamProjectScope} spanning
 * every project in a team.
 *
 * `Project` implements this directly, so every existing call site that
 * already passes a real `Project` keeps working unchanged; only the shared
 * query-building primitives in `RecordService`/`IssueService` need to widen
 * their parameter type to this interface to gain aggregate support.
 */
interface ProjectContext
{
    /**
     * @return array<int, int>
     */
    public function projectIds(): array;

    public function isAggregate(): bool;

    public function contextLabel(): string;

    public function contextSlug(): string;
}
