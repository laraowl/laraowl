import { Link, usePage, router } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import {
    BarChart2,
    ChevronDown,
    ArrowUpDown,
    User as UserIcon,
    Check,
} from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { appendMonitoringQuery } from '@/lib/monitoring-query';
import { formatCompactNumber } from '@/lib/utils';

export function IssueTable({
    issues,
    team_members = [],
    baseUrl = 'issues',
}: {
    issues: any;
    team_members?: any[];
    baseUrl?: string;
}) {
    const { props }: any = usePage();
    const teamSlug = props.currentTeam?.slug || props.current_team?.slug;
    const currentProject = props.currentProject || props.current_project;
    const projectSlug = currentProject?.slug;
    const isAggregate = Boolean(currentProject?.is_aggregate);
    const period = props.period as string | null | undefined;
    const from = props.from as string | null | undefined;
    const to = props.to as string | null | undefined;

    const data = issues.data || [];
    // In the "All" aggregate scope, always link to the issue's own project
    // — the current page is scoped to the whole team, not a single app.
    const issueHref = (issue: any) =>
        appendMonitoringQuery(
            `/${teamSlug}/${issue.project?.slug || projectSlug}/${baseUrl}/${baseUrl === 'issues' ? issue.id : issue.hash || issue.id}`,
            { period, from, to },
        );

    const updateIssue = (id: number, data: any, issue: any) => {
        router.patch(
            `/${teamSlug}/${issue.project?.slug || projectSlug}/${baseUrl}/${id}`,
            data,
            { preserveScroll: true },
        );
    };

    if (data.length === 0) {
        return (
            <div className="flex h-64 flex-col items-center justify-center bg-card text-muted-foreground">
                <p className="text-sm">No issues found.</p>
            </div>
        );
    }

    const priorities = ['none', 'low', 'medium', 'high', 'critical'];

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader className="border-b border-border bg-muted/30">
                    <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="hidden w-20 pl-6 md:table-cell">
                            <div className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                                ID <ArrowUpDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="min-w-[300px]">
                            <div className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                                ISSUE <ChevronDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        {isAggregate && (
                            <TableHead className="hidden md:table-cell">
                                Application
                            </TableHead>
                        )}
                        <TableHead className="hidden text-right sm:table-cell">
                            <div className="flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-foreground">
                                COUNT <ArrowUpDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="hidden text-right lg:table-cell">
                            <div className="flex cursor-pointer items-center justify-end gap-1 transition-colors hover:text-foreground">
                                USERS <ArrowUpDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="hidden text-right xl:table-cell">
                            <div className="flex cursor-pointer items-center justify-end gap-1 whitespace-nowrap transition-colors hover:text-foreground">
                                FIRST SEEN <ArrowUpDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="text-right text-foreground">
                            <div className="flex cursor-pointer items-center justify-end gap-1 font-bold whitespace-nowrap transition-colors hover:text-foreground">
                                LAST SEEN <ChevronDown className="h-3 w-3" />
                            </div>
                        </TableHead>
                        <TableHead className="hidden w-24 pr-6 text-right sm:table-cell">
                            ASSIGNED
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((issue: any) => (
                        <TableRow
                            key={issue.id}
                            className="group h-16 border-border transition-colors hover:bg-muted/30"
                        >
                            <TableCell className="hidden pl-6 font-mono text-xs text-muted-foreground md:table-cell">
                                #{issue.id}
                            </TableCell>
                            <TableCell>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="cursor-pointer rounded p-1 transition-colors hover:bg-muted">
                                            <BarChart2
                                                className={`h-4 w-4 ${
                                                    issue.priority ===
                                                    'critical'
                                                        ? 'text-red-500'
                                                        : issue.priority ===
                                                            'high'
                                                          ? 'text-orange-500'
                                                          : issue.priority ===
                                                              'medium'
                                                            ? 'text-yellow-500'
                                                            : issue.priority ===
                                                                'low'
                                                              ? 'text-blue-500'
                                                              : 'text-muted-foreground'
                                                }`}
                                            />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="border-border bg-popover text-popover-foreground">
                                        <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground uppercase">
                                            Set Priority
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-border" />
                                        {priorities.map((p) => (
                                            <DropdownMenuItem
                                                key={p}
                                                onClick={() =>
                                                    updateIssue(
                                                        issue.id,
                                                        { priority: p },
                                                        issue,
                                                    )
                                                }
                                                className="flex cursor-pointer items-center justify-between text-xs capitalize"
                                            >
                                                {p}
                                                {issue.priority === p && (
                                                    <Check className="h-3 w-3" />
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                            <TableCell>
                                <Link
                                    href={issueHref(issue)}
                                    className="flex w-[150px] flex-col sm:w-[250px] md:w-[350px] lg:w-[350px]"
                                >
                                    <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="truncate text-left text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                                                    {issue.title}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[400px] border-border bg-popover font-mono text-xs break-all text-popover-foreground shadow-2xl">
                                                {issue.title}
                                            </TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="mt-0.5 truncate text-left text-[11px] text-muted-foreground">
                                                    {issue.message}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-[400px] border-border bg-popover font-mono text-xs break-all text-popover-foreground shadow-2xl">
                                                {issue.message}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </Link>
                            </TableCell>
                            {isAggregate && (
                                <TableCell className="hidden truncate text-xs text-muted-foreground md:table-cell">
                                    {issue.project?.name || '—'}
                                </TableCell>
                            )}
                            <TableCell className="hidden text-right font-mono text-sm text-foreground sm:table-cell">
                                {formatCompactNumber(issue.records_count || 0)}
                            </TableCell>
                            <TableCell className="hidden text-right font-mono text-sm text-foreground lg:table-cell">
                                1
                            </TableCell>
                            <TableCell className="hidden text-right text-xs whitespace-nowrap text-muted-foreground xl:table-cell">
                                {issue.created_at
                                    ? formatDistanceToNow(
                                          new Date(issue.created_at),
                                          { addSuffix: false },
                                      ).replace('about ', '')
                                    : '--'}
                            </TableCell>
                            <TableCell className="text-right text-xs font-medium whitespace-nowrap text-foreground">
                                {issue.last_seen_at
                                    ? formatDistanceToNow(
                                          new Date(issue.last_seen_at),
                                          { addSuffix: false },
                                      ).replace('about ', '')
                                    : '--'}
                            </TableCell>
                            <TableCell className="hidden pr-6 text-right sm:table-cell">
                                <div className="flex justify-end">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="group/avatar flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-muted transition-all hover:border-primary/50">
                                                {issue.assignee ? (
                                                    <Avatar className="h-full w-full">
                                                        <AvatarFallback className="bg-primary/10 text-[10px] text-primary uppercase">
                                                            {issue.assignee.name.substring(
                                                                0,
                                                                2,
                                                            )}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ) : (
                                                    <UserIcon className="h-3 w-3 text-muted-foreground group-hover/avatar:text-foreground" />
                                                )}
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className="w-48 border-border bg-popover text-popover-foreground"
                                            align="end"
                                        >
                                            <DropdownMenuLabel className="text-[10px] tracking-widest text-muted-foreground uppercase">
                                                Assign To
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator className="bg-border" />
                                            <DropdownMenuItem
                                                onClick={() =>
                                                    updateIssue(
                                                        issue.id,
                                                        { assigned_to: null },
                                                        issue,
                                                    )
                                                }
                                                className="flex cursor-pointer items-center justify-between text-xs"
                                            >
                                                Unassigned
                                                {!issue.assigned_to && (
                                                    <Check className="h-3 w-3" />
                                                )}
                                            </DropdownMenuItem>
                                            {team_members.map((member: any) => (
                                                <DropdownMenuItem
                                                    key={member.id}
                                                    onClick={() =>
                                                        updateIssue(
                                                            issue.id,
                                                            {
                                                                assigned_to:
                                                                    member.id,
                                                            },
                                                            issue,
                                                        )
                                                    }
                                                    className="flex cursor-pointer items-center justify-between text-xs"
                                                >
                                                    {member.name}
                                                    {issue.assigned_to ===
                                                        member.id && (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Pagination links={issues.links} meta={issues} />
        </div>
    );
}
