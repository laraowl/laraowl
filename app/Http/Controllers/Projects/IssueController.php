<?php

namespace App\Http\Controllers\Projects;

use App\Concerns\ResolvesProjectScope;
use App\Http\Controllers\Controller;
use App\Models\Issue;
use App\Models\Project;
use App\Models\Team;
use App\Services\IssueService;
use App\Support\ExceptionTrace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class IssueController extends Controller
{
    use ResolvesProjectScope;

    protected IssueService $issueService;

    public function __construct(IssueService $issueService)
    {
        $this->issueService = $issueService;
    }

    /**
     * Display a listing of project issues.
     *
     * `$project` is the raw route segment rather than a bound `Project` so it
     * can also be the reserved "All" slug (see `ResolvesProjectScope`).
     * `show`/`update`/`comment` below stay bound to a real `Project`.
     */
    public function index(Request $request, Team $current_team, string $project): Response
    {
        $scope = $this->resolveProjectScope($current_team, $project);
        $filters = $request->only(['status', 'search']);

        return Inertia::render('projects/issues/index', [
            'issues' => $this->issueService->getPaginatedIssues($scope, $filters),
            'filters' => array_merge(['status' => 'open'], $filters),
            'counts' => $this->issueService->getIssueCounts($scope),
            'performance' => $this->issueService->getPerformanceStats($scope),
            'team_members' => $current_team->members,
        ]);
    }

    /**
     * Display the specified issue.
     */
    public function show(Team $current_team, Project $project, Issue $issue): Response
    {
        $issue->load(['assignee', 'records' => fn ($q) => $q->latest()->limit(1), 'activities.user']);

        if ($record = $issue->records->first()) {
            $record->payload = ExceptionTrace::normalize($record->payload);
        }

        return Inertia::render('projects/issues/show', [
            'issue' => $issue,
            'team_members' => $current_team->members,
        ]);
    }

    /**
     * Update the specified issue (status, priority, assignment).
     */
    public function update(Request $request, Team $current_team, Project $project, Issue $issue): RedirectResponse
    {
        $validated = $request->validate([
            'status' => 'sometimes|string|in:open,resolved,ignored',
            'priority' => 'sometimes|string|in:none,low,medium,high,critical',
            'assigned_to' => 'sometimes|nullable|exists:users,id',
        ]);

        $this->issueService->updateIssue($issue, $validated);

        return back()->with('success', 'Issue updated successfully.');
    }

    /**
     * Add a comment/activity to the issue.
     */
    public function comment(Request $request, Team $current_team, Project $project, Issue $issue): RedirectResponse
    {
        $validated = $request->validate(['comment' => 'required|string']);

        $this->issueService->addComment($issue, $validated['comment']);

        return back()->with('success', 'Comment added.');
    }
}
