<?php

namespace App\Http\Controllers\Projects;

use App\Concerns\ResolvesProjectScope;
use App\Http\Controllers\Controller;
use App\Models\Record;
use App\Models\Team;
use App\Services\RecordService;
use App\Support\ExceptionTrace;
use App\Support\ProjectContext;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class RecordController extends Controller
{
    use ResolvesProjectScope;

    protected RecordService $recordService;

    public function __construct(RecordService $recordService)
    {
        $this->recordService = $recordService;
    }

    /**
     * Unified Entry Point for Monitoring Dashboards.
     *
     * `$project` is the raw route segment rather than a bound `Project` so it
     * can also be the reserved "All" slug (see `ResolvesProjectScope`). The
     * drill-down/detail actions below accept the same aggregate scope.
     */
    public function index(Request $request, Team $current_team, string $project): Response
    {
        $scope = $this->resolveProjectScope($current_team, $project);

        $routeName = $request->route()->getName();
        $period = $request->query('period', '1h');
        $from = $request->query('from');
        $to = $request->query('to');

        if ($routeName === 'dashboard') {
            return $this->renderDashboardIndex($scope, $period, $from, $to);
        }

        $method = 'render'.Str::studly(str_replace('-', '_', $routeName)).'Index';

        if (method_exists($this, $method)) {
            return $this->{$method}($scope, $period, $from, $to);
        }

        // Fallback for generic record lists (Logs, Cache, etc.)
        $type = $this->resolveTypeFromRoute($routeName);

        return Inertia::render($this->resolveComponentPath($routeName), [
            'records' => $this->recordService->getPaginatedRecords($scope, $type, $request->search, $period, $from, $to),
            'filters' => $request->only(['search', 'period', 'from', 'to']),
            'stats' => $this->recordService->getQuickStats($scope, $period, $from, $to),
            'period' => $period,
            'from' => $from,
            'to' => $to,
        ]);
    }

    /**
     * Specialized Domain Renderers
     */
    protected function renderDashboardIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('dashboard', $this->recordService->getDashboardStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderRequestsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        $sort = request()->query('sort', 'total');
        $direction = request()->query('direction', 'desc');

        return $this->renderWithStats('projects/requests', $this->recordService->getRequestStats($project, $period, $from, $to, $sort, $direction), $project, $period, $from, $to);
    }

    protected function renderUsersIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/users', $this->recordService->getUserStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderJobsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/jobs', $this->recordService->getJobStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderExceptionsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/exceptions', $this->recordService->getExceptionStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderCommandsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/commands', $this->recordService->getCommandStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderQueriesIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/queries', $this->recordService->getQueryStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderScheduledTasksIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/scheduled-tasks', $this->recordService->getScheduledTaskStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderNotificationsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/notifications', $this->recordService->getNotificationStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderMailIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/mail', $this->recordService->getMailStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderOutgoingRequestsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/outgoing-requests', $this->recordService->getOutgoingRequestStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderUptimeIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/uptime', $this->recordService->getUptimeStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderSecurityIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/security', $this->recordService->getSecurityStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderCacheIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return $this->renderWithStats('projects/cache', $this->recordService->getCacheStats($project, $period, $from, $to), $project, $period, $from, $to);
    }

    protected function renderLogsIndex(ProjectContext $project, string $period, ?string $from, ?string $to): Response
    {
        return Inertia::render('projects/logs/index', [
            'records' => $this->recordService->getLogRecords($project, request('search'), $period, $from, $to),
            'filters' => request()->only(['search', 'period', 'from', 'to']),
            'stats' => $this->recordService->getQuickStats($project, $period, $from, $to),
            'period' => $period,
            'from' => $from,
            'to' => $to,
        ]);
    }

    /**
     * Drill-down Detail Handlers (Hashed)
     *
     * `$project` is the raw route segment, not a bound `Project`, so these
     * also work under the "All" aggregate slug: the history shown is every
     * matching record across the team's projects for that hash — consistent
     * with the list pages, which already merge rows by hash across projects
     * (see `RecordService::groupList()`) rather than keeping them separate.
     */
    public function showDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/requests/show');
    }

    public function showJobDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/jobs/show');
    }

    public function showExceptionDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/exceptions/show');
    }

    public function showQueryDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/queries/show');
    }

    public function showCommandDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/commands/show');
    }

    public function showScheduledTaskDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/scheduled-tasks/show');
    }

    public function showNotificationDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/notifications/show');
    }

    public function showMailDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/mail/show');
    }

    public function showOutgoingRequestDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        return $this->renderHistory($this->resolveProjectScope($current_team, $project), $hash, 'projects/outgoing-requests/show');
    }

    public function showUserDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        $scope = $this->resolveProjectScope($current_team, $project);
        $period = $request->query('period', '1h');
        $from = $request->query('from');
        $to = $request->query('to');

        return Inertia::render('projects/users/show', $this->recordService->getUserHistory($scope, $hash, $period, $from, $to));
    }

    public function showSecurityDetails(Request $request, Team $current_team, string $project, string $hash): Response
    {
        $scope = $this->resolveProjectScope($current_team, $project);
        $period = $request->query('period', '1h');
        $from = $request->query('from');
        $to = $request->query('to');

        return Inertia::render('projects/security/show', $this->recordService->getSecurityHistoryByHash($scope, $hash, $period, $from, $to));
    }

    /**
     * Helpers
     */
    protected function renderHistory(ProjectContext $project, string $hash, string $component): Response
    {
        $period = request()->query('period', '1h');
        $from = request()->query('from');
        $to = request()->query('to');
        $history = $this->recordService->getHistoryByHash($project, $hash, $period, $from, $to);

        // Find the best record to use for meta (one that has identifying info)
        $first = $history->firstWhere(function ($r) {
            return ! empty($r->payload['name']) ||
                   ! empty($r->payload['job']) ||
                   ! empty($r->payload['command']) ||
                   ! empty($r->payload['route_path']) ||
                   ! empty($r->payload['class']);
        }) ?: $history->first();

        return Inertia::render($component, [
            'hash' => $hash,
            'meta' => $first ? ExceptionTrace::normalize($first->payload) : [],
            'records' => $history,
            'period' => $period,
            'from' => $from,
            'to' => $to,
        ]);
    }

    protected function renderWithStats(string $component, array $data, ProjectContext $project, string $period, ?string $from = null, ?string $to = null): Response
    {
        return Inertia::render($component.'/index', array_merge($data, [
            'stats' => $this->recordService->getQuickStats($project, $period, $from, $to),
            'period' => $period,
            'from' => $from,
            'to' => $to,
        ]));
    }

    protected function resolveTypeFromRoute(string $routeName): string
    {
        $map = ['dashboard' => 'request', 'users' => 'user', 'security' => 'security'];

        return $map[$routeName] ?? Str::singular($routeName);
    }

    protected function resolveComponentPath(string $routeName): string
    {
        return $routeName === 'dashboard' ? 'dashboard' : 'projects/'.$routeName.'/index';
    }

    public function showOccurrence(Team $current_team, string $project, Record $record): Response
    {
        $scope = $this->resolveProjectScope($current_team, $project);

        // The record is bound by global id, so verify it belongs to a project
        // in scope for the URL — otherwise any member of any team could read
        // another team's telemetry by guessing record ids.
        abort_if(! in_array($record->project_id, $scope->projectIds(), true), 404);

        $record->load('issue');
        $relatedRecords = [];
        $traceId = $record->trace_id ?? ($record->payload['trace_id'] ?? null);

        if ($traceId) {
            $relatedRecords = Record::query()
                ->whereIn('project_id', $scope->projectIds())
                ->where('trace_id', $traceId)
                ->where('id', '!=', $record->id)
                ->orderBy('created_at')
                ->limit(200)
                ->get(['id', 'type', 'payload', 'created_at']);
        }

        return Inertia::render('projects/records/show', [
            'record' => $record,
            'relatedRecords' => $relatedRecords,
        ]);
    }
}
