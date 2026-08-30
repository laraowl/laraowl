import { Head, Link, usePage } from '@inertiajs/react';
import { Search, Clock, Activity, ArrowUpRight } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { formatMicroSeconds, formatCompactNumber } from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function ScheduledTaskDetails({
    hash,
    meta,
    records,
}: {
    hash: string;
    meta: any;
    records: any;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug = currentProject?.slug;
    const isAggregate = Boolean(currentProject?.is_aggregate);

    const command = meta?.command || meta?.name || meta?.job || 'Unknown Task';
    const recordHref = (record: number) =>
        showRecord.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                record,
            },
            { mergeQuery: {} },
        );

    return (
        <>
            <Head title={`Task: ${command}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="relative flex items-center justify-between overflow-hidden rounded-lg border border-border bg-card p-6 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-muted-foreground">
                        HASH: {hash}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="rounded-lg border border-border bg-muted p-3">
                            <Clock className="h-6 w-6 text-foreground" />
                        </div>
                        <div>
                            <h1 className="font-mono text-xl font-bold text-foreground">
                                {command}
                            </h1>
                            <div className="mt-1 flex items-center gap-2">
                                <Badge
                                    variant="secondary"
                                    className="border-border bg-muted text-[10px] text-muted-foreground uppercase"
                                >
                                    SCHEDULED TASK
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Runs Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(records.total)} Executions
                            </span>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full rounded-md border border-border bg-muted py-1.5 pl-8 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                placeholder="Search runs"
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                    <TableHead>Date</TableHead>
                                    {isAggregate && (
                                        <TableHead>Application</TableHead>
                                    )}
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">
                                        Duration
                                    </TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.data.map((record: any) => (
                                    <TableRow
                                        key={record.id}
                                        className="group border-border transition-colors hover:bg-muted/30"
                                    >
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {new Date(
                                                record.created_at,
                                            ).toLocaleString()}
                                        </TableCell>
                                        {isAggregate && (
                                            <TableCell className="text-xs text-muted-foreground">
                                                {record.project?.name || '—'}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={`text-[10px] font-bold uppercase ${record.payload.status?.toUpperCase() === 'PROCESSED' ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500' : 'border-red-500/20 bg-red-500/5 text-red-500'} rounded-sm px-2 py-0`}
                                            >
                                                {record.payload.status ||
                                                    'STARTED'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-foreground/90">
                                            {record.payload.duration
                                                ? formatMicroSeconds(
                                                      record.payload.duration,
                                                  )
                                                : 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={recordHref(record.id)}>
                                                <div className="rounded border border-border bg-muted p-1 transition-all group-hover:border-border">
                                                    <ArrowUpRight className="h-3 w-3" />
                                                </div>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Pagination links={records.links} meta={records} />
                    </div>
                </div>
            </div>
        </>
    );
}

ScheduledTaskDetails.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Scheduled Tasks', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
