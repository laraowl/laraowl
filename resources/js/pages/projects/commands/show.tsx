import { Head, Link, usePage } from '@inertiajs/react';
import { Terminal, Search, ArrowUpRight, Activity } from 'lucide-react';
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

export default function CommandShow({
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

    const commandName = meta?.command || 'Unknown Command';
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
            <Head title={`Command - ${commandName}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-card p-6 shadow-2xl">
                    <div className="rounded-lg border border-border bg-muted p-3">
                        <Terminal className="h-6 w-6 text-foreground" />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            {commandName}
                        </h1>
                        <div className="mt-1 flex items-center gap-3">
                            <span className="font-mono text-[10px] text-muted-foreground">
                                HASH: {hash}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Table Section */}
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
                                placeholder="Search executions"
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
                                    <TableHead>Arguments</TableHead>
                                    <TableHead className="text-center">
                                        Exit Code
                                    </TableHead>
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
                                            <span className="max-w-md truncate font-mono text-xs text-foreground/90">
                                                {record.payload.arguments ||
                                                    (record.payload.command?.includes(
                                                        ' ',
                                                    )
                                                        ? record.payload.command.substring(
                                                              record.payload.command.indexOf(
                                                                  ' ',
                                                              ) + 1,
                                                          )
                                                        : 'NONE')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                className={`text-[10px] font-bold ${record.payload.exit_code != 0 && record.payload.exit_code !== undefined ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'} border-none`}
                                            >
                                                {record.payload.exit_code ??
                                                    (record.payload.status ===
                                                    'started'
                                                        ? 'RUNNING'
                                                        : 0)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-xs text-foreground/90">
                                            {formatMicroSeconds(
                                                record.payload.duration,
                                            )}
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

CommandShow.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Commands', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
