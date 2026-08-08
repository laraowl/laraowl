import { Head, Link, usePage } from '@inertiajs/react';
import { User, Search, ArrowUpRight, Activity } from 'lucide-react';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import {
    formatMicroSeconds,
    formatCompactNumber,
    formatValue,
} from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function UserShow({
    user_name,
    user_email,
    user_id,
    user_identifier,
    records,
    stats,
}: {
    user_name?: string;
    user_email?: string;
    user_id?: string | number;
    user_identifier: string;
    records: any;
    stats: any;
}) {
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug = currentProject?.slug;
    const isAggregate = Boolean(currentProject?.is_aggregate);
    const displayName = user_name || user_identifier || 'Unknown User';
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
            <Head title={`User - ${displayName}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-6 shadow-2xl">
                    <div className="rounded-full bg-emerald-500/10 p-3">
                        <User className="h-8 w-8 text-emerald-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {displayName}
                        </h1>
                        <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {user_email || (user_id && `ID: ${user_id}`)}
                        </p>
                        {user_email && user_id && (
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                                ID: {user_id}
                            </p>
                        )}
                    </div>
                </div>

                {/* Info & Stats Row */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="border-border bg-card lg:col-span-1">
                        <CardContent className="space-y-4 p-6 text-sm">
                            <div className="border-b border-border pb-2 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                Activity Info
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold tracking-tighter text-muted-foreground uppercase">
                                        Last Seen
                                    </span>
                                    <span className="font-mono text-xs text-foreground">
                                        {stats.last_seen
                                            ? new Date(
                                                  stats.last_seen,
                                              ).toLocaleString()
                                            : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold tracking-tighter text-muted-foreground uppercase">
                                        First Seen
                                    </span>
                                    <span className="font-mono text-xs text-foreground">
                                        {stats.first_seen
                                            ? new Date(
                                                  stats.first_seen,
                                              ).toLocaleString()
                                            : 'N/A'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold tracking-tighter text-muted-foreground uppercase">
                                        Requests
                                    </span>
                                    <span className="font-bold text-foreground">
                                        {formatCompactNumber(stats.total)}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="flex flex-col items-center justify-center overflow-hidden border-border bg-card p-6 lg:col-span-2">
                        <div className="flex gap-8">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-foreground">
                                    {formatCompactNumber(stats.total)}
                                </div>
                                <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Total Hits
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-emerald-500">
                                    {formatCompactNumber(
                                        stats.ok_count || stats.total,
                                    )}
                                </div>
                                <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Successful
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-red-500">
                                    {formatCompactNumber(
                                        stats.error_count || 0,
                                    )}
                                </div>
                                <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Errors
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Table Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(records.total)} Latest
                                Requests
                            </span>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full rounded-md border border-border bg-muted py-1.5 pl-8 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                placeholder="Search activity"
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
                                    <TableHead>Method</TableHead>
                                    <TableHead>URL</TableHead>
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
                                        <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
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
                                                className={`text-[10px] font-bold uppercase ${record.type === 'request' ? (record.payload.method === 'POST' ? 'border-blue-400/20 text-blue-400' : 'border-emerald-400/20 text-emerald-400') : 'border-orange-400/20 text-orange-400'}`}
                                            >
                                                {record.type === 'request'
                                                    ? record.payload.method
                                                    : record.type.replace(
                                                          '-',
                                                          ' ',
                                                      )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-xs truncate font-mono text-xs text-muted-foreground"
                                                title={formatValue(
                                                    record.payload.url ||
                                                        record.payload.name,
                                                )}
                                            >
                                                {record.type === 'request'
                                                    ? record.payload
                                                          .route_path ||
                                                      record.payload.url ||
                                                      record.payload.path
                                                    : formatValue(
                                                          record.payload.name ||
                                                              record.payload
                                                                  .command ||
                                                              record.payload
                                                                  .job ||
                                                              'No Identifier',
                                                      )}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`text-[10px] font-bold ${(record.payload.status_code || record.payload.exit_code) >= 400 || record.payload.status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'} border-none`}
                                            >
                                                {record.payload.status_code ||
                                                    record.payload.status ||
                                                    (record.payload
                                                        .exit_code === 0
                                                        ? 'SUCCESS'
                                                        : record.payload
                                                              .exit_code) ||
                                                    'OK'}
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

UserShow.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Users', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
