<?php

namespace App\Services;

use App\Concerns\BuildsRollupQueries;
use App\Models\Issue;
use App\Models\Project;
use App\Models\Record;
use App\Models\RecordGroupRollup;
use App\Models\RecordGroupUserBucket;
use App\Models\RecordIpBucket;
use App\Models\RecordRollup;
use App\Models\RecordUserBucket;
use App\Models\UptimeCheck;
use App\Support\ProjectContext;
use Carbon\Carbon;
use Cron\CronExpression;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RecordService
{
    use BuildsRollupQueries;

    /**
     * Get aggregated stats for various record types.
     */
    public function getQuickStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $types = ['request', 'exception', 'query', 'queued-job', 'job-attempt', 'scheduled-task', 'cache-event', 'log', 'mail', 'notification', 'outgoing-request'];

        $counts = RecordRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->whereIn('type', $types)
            ->forPeriod($period, $from, $to)
            ->select('type', DB::raw('SUM('.$this->col('count').') as total'))
            ->groupBy('type')
            ->pluck('total', 'type');

        $stats = [];

        foreach ($types as $type) {
            $stats[str_replace('-', '_', $type).'s'] = (int) ($counts[$type] ?? 0);
        }

        // Aggregate jobs
        $stats['jobs'] = $stats['queued_jobs'] + $stats['job_attempts'];

        return $stats;
    }

    /**
     * Aggregate Request Data
     */
    public function getRequestStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null, string $sort = 'total', string $direction = 'desc'): array
    {
        $allowedSorts = ['method', 'path', 'total', 'ok_count', 'client_error_count', 'server_error_count', 'avg_duration', 'p95_duration'];
        $sort = in_array($sort, $allowedSorts) ? $sort : 'total';
        $direction = $direction === 'asc' ? 'asc' : 'desc';

        $overview = $this->rollupTotals($project, 'request', $period, $from, $to);

        $requests = $this->groupList(
            $project, 'request', $period, $from, $to,
            sort: $sort,
            direction: $direction,
            sortMap: ['method' => 'label', 'path' => 'sublabel', 'p95_duration' => 'max_duration'],
        )->through(function ($row) {
            $row->method = $row->label;
            $row->path = $row->sublabel;

            return $row;
        });

        return [
            'requests' => $requests,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'overview' => [
                'ok' => (int) $overview->ok,
                'client_error' => (int) $overview->client_error,
                'server_error' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'max_duration' => round((float) ($overview->max_duration ?? 0), 2),
                'min_duration' => round((float) ($overview->min_duration ?? 0), 2),
            ],
            'sort' => $sort,
            'direction' => $direction,
        ];
    }

    /**
     * Get comprehensive dashboard metrics.
     */
    public function getDashboardStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $requestStats = $this->rollupTotals($project, 'request', $period, $from, $to);
        $exceptionStats = $this->rollupTotals($project, 'exception', $period, $from, $to);
        $jobStats = $this->rollupTotals($project, ['job-attempt', 'queued-job'], $period, $from, $to);

        $impactedUsers = $this->topUsers($project, 'exception', 'error_count', $period, $from, $to);
        $activeUsers = $this->topUsers($project, 'request', 'request_count', $period, $from, $to);

        $this->enrichUserRows($project, $impactedUsers);
        $this->enrichUserRows($project, $activeUsers);

        return [
            'total_requests' => (int) $requestStats->total,
            'request_breakdown' => [
                'ok' => (int) $requestStats->ok,
                'client_error' => (int) $requestStats->client_error,
                'server_error' => (int) $requestStats->server_error,
            ],
            'duration_stats' => [
                'avg' => round($this->avgDuration($requestStats), 2),
                'max' => round((float) ($requestStats->max_duration ?? 0), 2),
                'min' => round((float) ($requestStats->min_duration ?? 0), 2),
            ],
            'total_exceptions' => (int) $exceptionStats->total,
            'recent_issues' => Issue::query()
                ->whereIn('project_id', $project->projectIds())
                ->where('status', 'open')
                ->with('project:id,name,slug')
                ->latest('last_seen_at')
                ->limit(5)
                ->get(),
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'exceptionTimeSeries' => $this->getDetailedTimeSeries($project, 'exception', $period, $from, $to),
            'job_stats' => [
                'total' => (int) $jobStats->total,
                'processed' => (int) $jobStats->ok,
                'failed' => (int) $jobStats->server_error,
                'released' => (int) $jobStats->neutral,
                'avg_duration' => round($this->avgDuration($jobStats) / 1000, 2),
                'p95_duration' => round($this->p95Duration($jobStats) / 1000, 2),
            ],
            'impacted_users' => $impactedUsers,
            'active_users' => $activeUsers,
            'auth_users_count' => $this->distinctUsers($project, 'request', $period, $from, $to),
            'guest_users_count' => (int) $requestStats->total - (int) $requestStats->authed,
            'period' => $period,
            'uptime_status' => $project->isAggregate()
                ? $this->aggregateUptimeStatus($project)
                : [
                    'current' => $project->last_uptime_status ?? 'unknown',
                    'last_check' => $project->last_uptime_check_at ? $project->last_uptime_check_at->toIso8601String() : null,
                    'url' => $project->url,
                    'up' => $project->last_uptime_status === 'up' ? 1 : 0,
                    'down' => $project->last_uptime_status === 'down' ? 1 : 0,
                    'total' => 1,
                ],
        ];
    }

    /**
     * Uptime status summary for the "All" aggregate scope, shaped to match
     * the single-project `uptime_status` payload so the dashboard card needs
     * no changes beyond rendering counts: `total` is every project in scope
     * (not just the ones already checked), `last_check` is the oldest check
     * across all of them (the most overdue one, worth drawing attention to),
     * and `current` collapses to 'up' only if none are down.
     */
    private function aggregateUptimeStatus(ProjectContext $project): array
    {
        $projects = Project::query()
            ->whereIn('id', $project->projectIds())
            ->get(['last_uptime_status', 'last_uptime_check_at']);

        $up = $projects->where('last_uptime_status', 'up')->count();
        $down = $projects->where('last_uptime_status', 'down')->count();
        $total = $projects->count();
        $oldestCheck = $projects->pluck('last_uptime_check_at')->filter()->min();

        return [
            'current' => $total === 0 ? 'unknown' : ($down === 0 ? 'up' : 'down'),
            'last_check' => $oldestCheck?->toIso8601String(),
            'url' => null,
            'up' => $up,
            'down' => $down,
            'total' => $total,
        ];
    }

    /**
     * Aggregate User Data
     */
    public function getUserStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $statusCode = $this->jsonNumeric('status_code');
        $userHash = "MD5(COALESCE({$this->jsonText('user')}, 'Anonymous'))";

        $requestTotals = $this->rollupTotals($project, 'request', $period, $from, $to);
        $authCount = $this->distinctUsers($project, 'request', $period, $from, $to);
        $totalAuthRequests = (int) $requestTotals->authed;
        $guestCount = (int) $requestTotals->total - $totalAuthRequests;

        $userKey = $this->col('user_key');
        $isRequest = $this->col('type')." = 'request'";
        $isException = $this->col('type')." = 'exception'";

        $users = RecordUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw("{$userKey} as user_id"),
                DB::raw("{$userKey} as user_name"),
                DB::raw("'' as user_email"),
                DB::raw("MD5({$userKey}) as hash"),
                DB::raw("SUM(CASE WHEN {$isRequest} THEN ".$this->col('count').' ELSE 0 END) as total_requests'),
                DB::raw("SUM(CASE WHEN {$isRequest} THEN ".$this->col('error_count').' ELSE 0 END) as error_count'),
                DB::raw("SUM(CASE WHEN {$isException} THEN ".$this->col('count').' ELSE 0 END) as exception_count'),
                DB::raw('MAX('.$this->col('last_seen_at').') as last_seen'),
            ])
            ->groupBy('user_key')
            ->orderBy('last_seen', 'desc')
            ->paginate(20)
            ->withQueryString();

        return [
            'users' => $this->enrichUserPaginator($project, $users),
            'timeSeries' => $this->getDetailedTimeSeries($project, 'request', $period, $from, $to),
            'overview' => [
                'auth_users' => $authCount,
                'guest_requests' => $guestCount,
                'auth_requests' => $totalAuthRequests,
            ],
        ];
    }

    /**
     * Aggregate Job Data
     */
    public function getJobStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $types = ['job-attempt', 'queued-job'];

        $overview = $this->rollupTotals($project, $types, $period, $from, $to);

        $jobs = $this->groupList($project, $types, $period, $from, $to)
            ->through(function ($row) {
                $row->job_class = $row->label ?? 'Unknown Job';
                $row->processed_count = (int) $row->ok_count;
                $row->failed_count = (int) $row->server_error_count;

                return $row;
            });

        return [
            'jobs' => $jobs,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'job-attempt', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'processed' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
                'max_duration' => round((float) ($overview->max_duration ?? 0), 2),
            ],
        ];
    }

    /**
     * Exceptions Aggregation
     */
    public function getExceptionStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $overview = $this->rollupTotals($project, 'exception', $period, $from, $to);

        $uniqueTypes = $this->distinctGroups($project, 'exception', $period, $from, $to);

        $exceptions = $this->groupList($project, 'exception', $period, $from, $to, sort: 'last_seen');

        $userCounts = RecordGroupUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', 'exception')
            ->whereIn('group_key', collect($exceptions->items())->pluck('hash')->all())
            ->forPeriod($period, $from, $to)
            ->select('group_key', DB::raw('COUNT(DISTINCT '.$this->col('user_key').') as users'))
            ->groupBy('group_key')
            ->pluck('users', 'group_key');

        $exceptions->through(function ($row) use ($userCounts) {
            $row->class = $row->label;
            $row->message = $row->sublabel;
            $row->total_count = (int) $row->total;
            $row->user_count = (int) ($userCounts[$row->hash] ?? 0);

            return $row;
        });

        return [
            'exceptions' => $exceptions,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'exception', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'unique' => $uniqueTypes,
            ],
        ];
    }

    /**
     * Commands Aggregation
     */
    public function getCommandStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $exitCode = $this->jsonNumeric('exit_code');
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'command', $period, $from, $to);

        $commands = $this->groupList($project, 'command', $period, $from, $to)
            ->through(function ($row) {
                $row->command_name = $row->label ?? 'Unknown Command';
                $row->success_count = (int) $row->ok_count;
                $row->failed_count = (int) $row->server_error_count;

                return $row;
            });

        return [
            'commands' => $commands,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'command', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'success' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
            ],
        ];
    }

    /**
     * Scheduled Tasks Aggregation
     */
    public function getScheduledTaskStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $exitCode = $this->jsonNumeric('exit_code');
        $duration = $this->jsonNumeric('duration');
        $status = $this->jsonText('status');

        $overview = $this->rollupTotals($project, 'scheduled-task', $period, $from, $to);

        $tasks = $this->groupList($project, 'scheduled-task', $period, $from, $to)
            ->through(function ($task) {
                $task->command = $task->label ?? 'Unknown Task';
                $task->schedule = $task->sublabel;
                $task->processed_count = (int) $task->ok_count;
                $task->failed_count = (int) $task->server_error_count;
                $task->skipped_count = (int) $task->neutral_count;

                try {
                    if ($task->schedule) {
                        $cron = new CronExpression($task->schedule);
                        $task->next_run = $cron->getNextRunDate()->format('Y-m-d H:i:s');
                    } else {
                        $task->next_run = 'N/A';
                    }
                } catch (\Exception $e) {
                    $task->next_run = 'Invalid Schedule';
                }

                return $task;
            });

        return [
            'tasks' => $tasks,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'scheduled-task', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'success' => (int) $overview->ok,
                'failed' => (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
            ],
        ];
    }

    /**
     * Query Aggregation
     */
    public function getQueryStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'query', $period, $from, $to);

        $queries = $this->groupList($project, 'query', $period, $from, $to)
            ->through(function ($row) {
                $row->sql_query = $row->sublabel;
                $row->db_connection = $row->label ?? 'mysql';
                $row->total_calls = (int) $row->total;
                $row->total_duration = (float) $row->sum_duration;

                return $row;
            });

        return [
            'queries' => $queries,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'query', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'avg_duration' => round($this->avgDuration($overview), 2),
            ],
        ];
    }

    /**
     * Outgoing Requests Aggregation
     */
    public function getOutgoingRequestStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $statusCode = $this->jsonNumeric('status_code');
        $status = $this->jsonNumeric('status');
        $resolvedStatus = "COALESCE({$statusCode}, {$status})";
        $duration = $this->jsonNumeric('duration');

        $overview = $this->rollupTotals($project, 'outgoing-request', $period, $from, $to);

        $hosts = $this->groupList($project, 'outgoing-request', $period, $from, $to)
            ->through(function ($row) {
                $row->host = $row->label;

                return $row;
            });

        return [
            'hosts' => $hosts,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'outgoing-request', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'ok' => (int) $overview->ok,
                'failed' => (int) $overview->client_error + (int) $overview->server_error,
                'avg_duration' => round($this->avgDuration($overview), 2),
            ],
        ];
    }

    /**
     * Cache Aggregation
     */
    public function getCacheStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $cacheType = $this->jsonText('type');

        $overview = $this->rollupTotals($project, 'cache-event', $period, $from, $to);

        $keys = $this->groupList($project, 'cache-event', $period, $from, $to)
            ->through(function ($row) {
                $row->cache_key = $row->label;
                $row->hit_rate = $row->total > 0 ? round(((int) $row->hits / (int) $row->total) * 100, 2) : 0;

                return $row;
            });

        return [
            'keys' => $keys,
            'timeSeries' => $this->getDetailedTimeSeries($project, 'cache-event', $period, $from, $to),
            'overview' => [
                'total' => (int) $overview->total,
                'hits' => (int) $overview->hits,
                'misses' => (int) $overview->misses,
                'hit_rate' => $overview->total > 0 ? round(((int) $overview->hits / (int) $overview->total) * 100, 2) : 0,
            ],
        ];
    }

    /**
     * Notification Aggregation
     */
    public function getNotificationStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $status = $this->jsonText('status');

        $overview = $this->rollupTotals($project, 'notification', $period, $from, $to);

        $channelsCount = $this->distinctGroups($project, 'notification', $period, $from, $to, 'sublabel');

        $notifications = $this->groupList($project, 'notification', $period, $from, $to)
            ->through(function ($row) {
                $row->notification_class = $row->label;
                $row->channel = $row->sublabel;
                $row->failed_count = (int) $row->server_error_count;
                $row->sent_count = (int) $row->total - $row->failed_count;

                return $row;
            });

        return [
            'notifications' => $notifications,
            'overview' => [
                'total' => (int) $overview->total,
                'channels' => $channelsCount,
            ],
        ];
    }

    /**
     * Mail Aggregation
     */
    public function getMailStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $mailer = $this->jsonText('mailer');

        $overview = $this->rollupTotals($project, 'mail', $period, $from, $to);

        $uniqueMailables = $this->distinctGroups($project, 'mail', $period, $from, $to);

        $mailables = $this->groupList($project, 'mail', $period, $from, $to)
            ->through(function ($row) {
                $row->mailable_class = $row->label;
                $row->queued_count = (int) $row->ok_count;

                return $row;
            });

        return [
            'mailables' => $mailables,
            'overview' => [
                'total' => (int) $overview->total,
                'unique' => $uniqueMailables,
            ],
        ];
    }

    /**
     * Unified History Retriever via Fingerprint
     *
     * Under the "All" aggregate scope this merges every project's records
     * for the hash — consistent with the list pages, which already merge
     * rows by hash across projects rather than keeping them separate (see
     * `groupList()`).
     */
    public function getHistoryByHash(ProjectContext $project, string $hash, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return Record::query()
            ->whereIn('project_id', $project->projectIds())
            ->with('project:id,name,slug')
            ->where('fingerprint', $hash)
            ->forPeriod($period, $from, $to)
            ->latest()
            ->paginate(50)
            ->withQueryString()
            ->through(function ($record) {
                if (isset($record->payload['payload']) && is_array($record->payload['payload'])) {
                    $record->payload = array_merge($record->payload, $record->payload['payload']);
                }

                return $record;
            });
    }

    /**
     * Get specific user history with additional stats
     */
    public function getUserHistory(ProjectContext $project, string $hash, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $userKey = $this->resolveUserKeyFromHash($project, $hash);

        $records = Record::query()
            ->whereIn('project_id', $project->projectIds())
            ->with('project:id,name,slug')
            ->where('user_key', $userKey)
            ->forPeriod($period, $from, $to)
            ->latest()
            ->paginate(50)
            ->withQueryString();

        $first = $records->first();
        $user_name = 'Anonymous';
        $user_email = '';
        $user_id = 'Anonymous';

        if ($first) {
            $p = $first->payload;
            $user_name = $p['user']['name'] ?? $p['user_name'] ?? $p['user'] ?? 'Anonymous';
            $user_email = $p['user']['email'] ?? $p['user_email'] ?? '';
            $user_id = $p['user']['id'] ?? $p['user'] ?? 'Anonymous';
        }

        $details = $this->userDetailsByIds($project, [$user_id]);

        if (isset($details[(string) $user_id])) {
            $user_name = $details[(string) $user_id]['name'] ?: $user_name;
            $user_email = $details[(string) $user_id]['email'] ?: $user_email;
        }

        return [
            'user_name' => $user_name,
            'user_email' => $user_email,
            'user_id' => $user_id,
            'user_identifier' => $user_name, // legacy support
            'records' => $records,
            'stats' => Record::query()
                ->whereIn('project_id', $project->projectIds())
                ->forPeriod($period, $from, $to)
                ->where('user_key', $userKey)
                ->select([
                    DB::raw('COUNT(*) as total'),
                    DB::raw('MIN(created_at) as first_seen'),
                    DB::raw('MAX(created_at) as last_seen'),
                ])->first(),
        ];
    }

    /**
     * Searched over `record_user_buckets`, which holds one row per user per
     * hour rather than one per record.
     */
    protected function resolveUserKeyFromHash(ProjectContext $project, string $hash): ?string
    {
        return RecordUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->whereRaw('MD5('.$this->col('user_key').') = ?', [$hash])
            ->value('user_key');
    }

    /**
     * Get general stats methods for other types (Mails, Notifications, etc.)
     */
    public function getMonitoringStats(Project $project, string $type, array $fields, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $select = ['fingerprint as hash', DB::raw('COUNT(*) as total')];
        $groupBy = ['fingerprint'];

        foreach ($fields as $alias => $path) {
            $select[] = DB::raw("{$this->jsonText($path)} as {$alias}");
            $groupBy[] = $alias;
        }

        $key = Str::plural(str_replace('-', '_', $type));

        return [
            $key => $project->records()
                ->ofType($type)
                ->forPeriod($period, $from, $to)
                ->select($select)
                ->groupBy($groupBy)
                ->paginate(20)->withQueryString(),
        ];
    }

    /**
     * Get paginated logs with flattened payload if needed.
     */
    public function getLogRecords(ProjectContext $project, ?string $search = null, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return $this->paginateRawRecords($project, 'log', $search, $period, $from, $to, searchMessage: true)
            ->through(function ($record) {
                if (isset($record->payload['payload']) && is_array($record->payload['payload'])) {
                    $record->payload = array_merge($record->payload, $record->payload['payload']);
                }

                return $record;
            });
    }

    /**
     * Common method to paginate records for a specific type.
     */
    public function getPaginatedRecords(ProjectContext $project, string $type, ?string $search = null, ?string $period = null, ?string $from = null, ?string $to = null): LengthAwarePaginator
    {
        return $this->paginateRawRecords($project, $this->resolveRecordType($type), $search, $period, $from, $to);
    }

    /**
     * A page of raw records, counted by the rollups rather than by the database.
     */
    protected function paginateRawRecords(ProjectContext $project, string $type, ?string $search, ?string $period, ?string $from, ?string $to, bool $searchMessage = false): LengthAwarePaginator
    {
        $query = Record::query()
            ->whereIn('project_id', $project->projectIds())
            ->with('project:id,name,slug')
            ->ofType($type)
            ->forPeriod($period, $from, $to)
            ->latest();

        if ($search) {
            if ($searchMessage) {
                $this->applyMessageSearch($query, $search);
            } else {
                $query->where('payload', 'like', '%'.$search.'%');
            }

            return $query->paginate(50)->withQueryString();
        }

        return $this->paginateWithKnownTotal($query, $this->rollupCount($project, $type, $period, $from, $to));
    }

    /**
     * Search the FULLTEXT-indexed `message` column.
     *
     * Uses the index on MySQL/MariaDB and PostgreSQL. FULLTEXT ignores tokens
     * shorter than its minimum length, and SQLite has no such index, so those
     * cases fall back to a LIKE over the same narrow column — still far cheaper
     * than scanning the JSON payload.
     *
     * @param  Builder<Record>|HasMany<Record, Project>  $query
     */
    protected function applyMessageSearch($query, string $search): void
    {
        $term = trim($search);
        $driver = DB::connection()->getDriverName();

        if ($term !== '' && mb_strlen($term) >= 3 && in_array($driver, ['mysql', 'mariadb', 'pgsql'], true)) {
            $query->whereFullText('message', $term);

            return;
        }

        $query->where('message', 'like', '%'.$term.'%');
    }

    /**
     * Map a route segment onto the record type the client emits.
     */
    protected function resolveRecordType(string $type): string
    {
        return [
            'job' => 'job-attempt',
            'cache' => 'cache-event',
        ][$type] ?? $type;
    }

    /**
     * Security Threats Aggregation
     */
    public function getSecurityStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $status = $this->jsonText('status');

        $uniqueIps = RecordIpBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', 'request')
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count('ip');

        $totalRequests = $this->rollupCount($project, 'request', $period, $from, $to);

        $overview = (object) [
            'unique_ips' => $uniqueIps,
            'total_requests' => $totalRequests,
        ];

        $recordsQuery = fn () => Record::query()->whereIn('project_id', $project->projectIds());

        // Failed logins (last 24h or selected period)
        $failedLogins = $recordsQuery()
            ->ofType('auth-event')
            ->forPeriod($period, $from, $to)
            ->whereRaw("{$status} = 'failed'")
            ->count();

        // Recent suspicious auth events
        $recentAuthEvents = $recordsQuery()
            ->ofType('auth-event')
            ->forPeriod($period, $from, $to)
            ->whereRaw("{$status} = 'failed'")
            ->latest()
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'user' => $r->payload['user'] ?? $r->payload['email'] ?? 'Anonymous',
                'ip' => $r->payload['ip'] ?? 'Unknown',
                'type' => $r->payload['event_type'] ?? 'Login Failure',
                'location' => $r->payload['location'] ?? 'Unknown',
                'time' => $r->created_at->diffForHumans(),
            ]);

        return [
            'threats' => Issue::query()
                ->whereIn('project_id', $project->projectIds())
                ->where('type', 'security')
                ->with('project:id,name,slug')
                ->select([
                    'id',
                    'project_id',
                    'hash',
                    'title',
                    'message',
                    'occurrences_count',
                    'last_seen_at',
                ])
                ->orderBy('last_seen_at', 'desc')
                ->paginate(20)->withQueryString(),
            'overview' => [
                'unique_ips' => (int) ($overview->unique_ips ?? 0),
                'total_scanned' => (int) ($overview->total_requests ?? 0),
                'failed_logins' => $failedLogins,
                'recent_auth_events' => $recentAuthEvents,
            ],
        ];
    }

    /**
     * Time series aggregation for dashboards
     */
    protected function getDetailedTimeSeries(ProjectContext $project, string $type, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        $period = $period ?: '1h';

        $groupsByMinute = ! in_array($period, ['7d', '14d', '30d', 'custom'], true);
        $bucket = $groupsByMinute ? $this->col('bucket') : $this->timeBucketSql($period, 'bucket');

        $sum = fn (string $column, string $alias) => DB::raw('SUM('.$this->col($column).') as '.$alias);

        $results = RecordRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw("{$bucket} as minute"),
                $sum('count', 'total'),
                $sum('ok_count', 'ok'),
                $sum('client_error_count', 'client_error'),
                $sum('server_error_count', 'server_error'),
                $sum('hits', 'hits'),
                $sum('misses', 'misses'),
                $sum('writes', 'writes'),
                $sum('authed_count', 'authed'),
                DB::raw('SUM('.$this->col('sum_duration').') / NULLIF(SUM('.$this->col('count_duration').'), 0) as avg_duration'),
            ])
            ->groupBy('minute')
            ->get();

        $userBucket = $groupsByMinute ? $this->col('bucket') : $bucket;

        $activeUsers = RecordUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw("{$userBucket} as slot"),
                DB::raw('COUNT(DISTINCT '.$this->col('user_key').') as active_users'),
            ])
            ->groupBy('slot')
            ->get()
            ->mapWithKeys(fn ($row) => [
                $groupsByMinute ? Carbon::parse($row->slot)->format('Y-m-d H') : $row->slot => (int) $row->active_users,
            ]);

        $results = $results->mapWithKeys(function ($row) use ($activeUsers, $groupsByMinute) {
            $key = $this->seriesKey($row->minute, $groupsByMinute);
            $userSlot = $groupsByMinute ? Carbon::parse($row->minute)->format('Y-m-d H') : $row->minute;
            $authed = (int) $row->authed;

            return [$key => [
                'minute' => $key,
                'total' => (int) $row->total,
                'ok' => (int) $row->ok,
                'client_error' => (int) $row->client_error,
                'server_error' => (int) $row->server_error,
                'avg_duration' => round((float) $row->avg_duration, 2),
                'hits' => (int) $row->hits,
                'misses' => (int) $row->misses,
                'writes' => (int) $row->writes,
                'active_users' => $activeUsers[$userSlot] ?? 0,
                'total_requests' => (int) $row->total,
                'authed' => $authed,
                'guest' => max((int) $row->total - $authed, 0),
            ]];
        });

        return $this->fillTimeSeriesGaps($results, $period, $from, $to);
    }

    private function enrichUserPaginator(ProjectContext $project, LengthAwarePaginator $paginator): LengthAwarePaginator
    {
        $this->enrichUserRows($project, $paginator->getCollection());

        return $paginator;
    }

    private function enrichUserRows(ProjectContext $project, iterable $rows): void
    {
        $ids = collect($rows)
            ->map(fn ($row) => (string) ($row->user_id ?? $row->user_identifier ?? $row->user_name ?? ''))
            ->filter(fn (string $id) => $id !== '' && $id !== 'Anonymous')
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $details = $this->userDetailsByIds($project, $ids->all());

        foreach ($rows as $row) {
            $id = (string) ($row->user_id ?? $row->user_identifier ?? $row->user_name ?? '');
            $detail = $details[$id] ?? null;

            if (! $detail) {
                continue;
            }

            if (($row->user_name ?? $row->user_identifier ?? '') === $id && $detail['name'] !== '') {
                $row->user_name = $detail['name'];
                $row->user_identifier = $detail['name'];
            }

            if (($row->user_email ?? '') === '' && $detail['email'] !== '') {
                $row->user_email = $detail['email'];
            }
        }
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return array<string, array{name: string, email: string}>
     */
    private function userDetailsByIds(ProjectContext $project, array $ids): array
    {
        $ids = collect($ids)
            ->map(fn (int|string $id): string => (string) $id)
            ->filter(fn (string $id): bool => $id !== '' && $id !== 'Anonymous')
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return [];
        }

        $details = [];

        Record::query()
            ->whereIn('project_id', $project->projectIds())
            ->ofType('user')
            ->whereIn(DB::raw($this->jsonText('id')), $ids->all())
            ->latest()
            ->get(['payload'])
            ->each(function ($record) use (&$details): void {
                $payload = $record->payload;
                $id = (string) ($payload['id'] ?? '');

                if ($id === '' || isset($details[$id])) {
                    return;
                }

                $username = (string) ($payload['username'] ?? '');

                $details[$id] = [
                    'name' => (string) ($payload['name'] ?? ''),
                    'email' => filter_var($payload['email'] ?? $username, FILTER_VALIDATE_EMAIL) ? (string) ($payload['email'] ?? $username) : '',
                ];
            });

        return $details;
    }

    public function getUptimeStats(ProjectContext $project, ?string $period = null, ?string $from = null, ?string $to = null): array
    {
        if ($project instanceof Project && ! $project->hasUptimeMonitoring()) {
            return [
                'checks' => new LengthAwarePaginator([], 0, 50),
                'uptime_stats' => [
                    'uptime_percentage' => 0,
                    'avg_response_time' => 0,
                    'last_check' => null,
                    'total_checks' => 0,
                ],
            ];
        }

        $query = UptimeCheck::query()
            ->whereIn('project_id', $project->projectIds())
            ->when($project->isAggregate(), fn ($q) => $q->with('project:id,name,slug'))
            ->orderBy('checked_at', 'desc');

        if ($period && $period !== 'all') {
            $minutes = match ($period) {
                '1h' => 60,
                '24h' => 1440,
                '7d' => 10080,
                '30d' => 43200,
                default => 1440
            };
            $query->where('checked_at', '>=', now()->subMinutes($minutes));
        }

        $checks = $query->paginate(50)->withQueryString();

        $totalChecks = UptimeCheck::query()->whereIn('project_id', $project->projectIds())->count();
        $upChecks = UptimeCheck::query()->whereIn('project_id', $project->projectIds())->where('status', 'up')->count();

        $stats = [
            'uptime_percentage' => $totalChecks > 0 ? round(($upChecks / $totalChecks) * 100, 2) : 100,
            'avg_response_time' => round(UptimeCheck::query()->whereIn('project_id', $project->projectIds())->avg('response_time') ?? 0, 2),
            'last_check' => UptimeCheck::query()->whereIn('project_id', $project->projectIds())->latest('checked_at')->first(),
            'total_checks' => $totalChecks,
        ];

        return [
            'checks' => $checks,
            'uptime_stats' => $stats,
        ];
    }

    public function getSecurityHistoryByHash(ProjectContext $project, string $hash, ?string $period = '24h', ?string $from = null, ?string $to = null): array
    {
        // If the same threat hash exists in more than one project under the
        // "All" scope, this picks one arbitrarily — same v1 simplification
        // as groupList()'s cross-project merge by hash.
        $issue = Issue::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('hash', $hash)
            ->firstOrFail();

        $records = Record::query()
            ->whereIn('project_id', $project->projectIds())
            ->with('project:id,name,slug')
            ->where(function ($q) use ($hash, $issue) {
                $q->where('issue_id', $issue->id)
                    ->orWhere(function ($sq) use ($hash) {
                        $sq->where('type', 'request')
                            ->where(function ($ssq) use ($hash) {
                                $ssq->whereJsonContains('payload->_security_threats', [['hash' => $hash]])
                                    ->orWhereJsonContains('payload->_security_changes', [['hash' => $hash]]);
                            });
                    });
            })
            ->forPeriod($period, $from, $to)
            ->orderBy('created_at', 'desc')
            ->paginate(50)
            ->withQueryString();

        return [
            'hash' => $hash,
            'meta' => [
                'title' => $issue->title,
                'message' => $issue->message,
                'occurrences' => $issue->occurrences_count,
                'last_seen_at' => $issue->last_seen_at,
            ],
            'records' => $records,
            'period' => $period,
        ];
    }

    /**
     * Paginate raw records without asking the database to count them.
     *
     * @param  Builder<Record>|HasMany<Record, Project>  $query
     */
    protected function paginateWithKnownTotal($query, int $total, int $perPage = 50): LengthAwarePaginator
    {
        $page = Paginator::resolveCurrentPage();

        $items = $total === 0
            ? collect()
            : $query->forPage($page, $perPage)->get();

        return new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => Paginator::resolveCurrentPath(),
            'query' => request()->query(),
        ]);
    }

    /**
     * How many records of these types the rollups counted over the period.
     *
     * @param  string|list<string>  $types
     */
    protected function rollupCount(ProjectContext $project, string|array $types, ?string $period, ?string $from, ?string $to): int
    {
        return (int) RecordRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->sum('count');
    }

    /**
     * Distinct groups of a type over the period, straight off the group rollups.
     */
    protected function distinctGroups(ProjectContext $project, string $type, ?string $period, ?string $from, ?string $to, string $column = 'group_key'): int
    {
        return RecordGroupRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count($column);
    }

    /**
     * Sum the pre-aggregated counters for the given record types over a period.
     *
     * @param  string|list<string>  $types
     */
    protected function rollupTotals(ProjectContext $project, string|array $types, ?string $period = null, ?string $from = null, ?string $to = null): object
    {
        $sum = fn (string $column, string $alias) => DB::raw('COALESCE(SUM('.$this->col($column).'), 0) as '.$alias);

        $columns = [
            $sum('count', 'total'),
            $sum('ok_count', 'ok'),
            $sum('client_error_count', 'client_error'),
            $sum('server_error_count', 'server_error'),
            $sum('neutral_count', 'neutral'),
            $sum('hits', 'hits'),
            $sum('misses', 'misses'),
            $sum('writes', 'writes'),
            $sum('authed_count', 'authed'),
            $sum('sum_duration', 'sum_duration'),
            $sum('count_duration', 'count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
            DB::raw('MIN('.$this->col('min_duration').') as min_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column, $column);
        }

        return RecordRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->select($columns)
            ->first();
    }

    /**
     * An approximate 95th percentile, read off the latency histogram.
     */
    protected function p95Duration(object $totals): float
    {
        $samples = (int) ($totals->count_duration ?? 0);

        if ($samples === 0) {
            return 0.0;
        }

        $target = 0.95 * $samples;
        $cumulative = 0;

        foreach (RollupWriter::LATENCY_BOUNDARIES as $boundary) {
            $cumulative += (int) ($totals->{'lat_le_'.$boundary} ?? 0);

            if ($cumulative >= $target) {
                return (float) $boundary;
            }
        }

        return (float) ($totals->max_duration ?? 0);
    }

    /**
     * The grouped list behind a type's top-N page, read from the group rollups.
     *
     * v1 limitation: grouped only by `group_key`, not also `project_id`. In
     * the "All" aggregate scope, two different projects producing the same
     * content hash (e.g. the same route on two apps) are summed into a
     * single row instead of shown per-app. Acceptable for now; revisit by
     * adding `project_id` to the group-by plus a project column if/when this
     * needs refining.
     *
     * @param  string|list<string>  $types
     * @param  array<string, string>  $extraColumns  alias => SQL aggregate
     * @param  array<string, string>  $sortMap  request sort key => SQL alias
     */
    protected function groupList(
        ProjectContext $project,
        string|array $types,
        ?string $period,
        ?string $from,
        ?string $to,
        array $extraColumns = [],
        string $sort = 'total',
        string $direction = 'desc',
        array $sortMap = [],
    ): LengthAwarePaginator {
        $sum = fn (string $column, string $alias) => DB::raw('SUM('.$this->col($column).') as '.$alias);

        $columns = [
            DB::raw($this->col('group_key').' as hash'),
            DB::raw('MAX('.$this->col('label').') as label'),
            DB::raw('MAX('.$this->col('sublabel').') as sublabel'),
            $sum('count', 'total'),
            $sum('ok_count', 'ok_count'),
            $sum('client_error_count', 'client_error_count'),
            $sum('server_error_count', 'server_error_count'),
            $sum('neutral_count', 'neutral_count'),
            $sum('hits', 'hits'),
            $sum('misses', 'misses'),
            $sum('writes', 'writes'),
            $sum('deletes', 'deletes'),
            $sum('sum_duration', 'sum_duration'),
            $sum('count_duration', 'count_duration'),
            DB::raw('MAX('.$this->col('max_duration').') as max_duration'),
            DB::raw('MIN('.$this->col('min_duration').') as min_duration'),
            DB::raw('MAX('.$this->col('last_seen_at').') as last_seen'),
            DB::raw('SUM('.$this->col('sum_duration').') / NULLIF(SUM('.$this->col('count_duration').'), 0) as avg_duration'),
        ];

        foreach (RollupWriter::latencyColumns() as $column) {
            $columns[] = $sum($column, $column);
        }

        foreach ($extraColumns as $alias => $expression) {
            $columns[] = DB::raw($expression.' as '.$alias);
        }

        $orderBy = $sortMap[$sort] ?? $sort;

        return RecordGroupRollup::query()
            ->whereIn('project_id', $project->projectIds())
            ->whereIn('type', (array) $types)
            ->forPeriod($period, $from, $to)
            ->select($columns)
            ->groupBy('group_key')
            ->orderBy($orderBy, $direction)
            ->paginate(20)
            ->withQueryString()
            ->through(function ($row) {
                $row->p95_duration = $this->p95Duration($row);
                $row->avg_duration = round((float) $row->avg_duration, 2);

                return $row;
            });
    }

    /**
     * The five users producing the most records of a type over a period.
     *
     * @return Collection<int, object>
     */
    protected function topUsers(ProjectContext $project, string $type, string $countAlias, ?string $period = null, ?string $from = null, ?string $to = null)
    {
        return RecordUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->select([
                DB::raw($this->col('user_key').' as user_id'),
                DB::raw($this->col('user_key').' as user_identifier'),
                DB::raw("'' as user_email"),
                DB::raw('SUM('.$this->col('count').') as '.$countAlias),
                DB::raw('MAX('.$this->col('bucket').') as last_seen'),
            ])
            ->groupBy('user_key')
            ->orderByDesc($countAlias)
            ->limit(5)
            ->get();
    }

    /**
     * Distinct users seen for a type over a period.
     */
    protected function distinctUsers(ProjectContext $project, string $type, ?string $period = null, ?string $from = null, ?string $to = null): int
    {
        return RecordUserBucket::query()
            ->whereIn('project_id', $project->projectIds())
            ->where('type', $type)
            ->forPeriod($period, $from, $to)
            ->distinct()
            ->count('user_key');
    }
}
