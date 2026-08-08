import { Head, Link, usePage } from '@inertiajs/react';
import { Database, Search, ArrowUpRight, Layers } from 'lucide-react';
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

export default function QueryDetails({
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

    const sql = meta?.sql || 'Unknown SQL Statement';
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
            <Head title="Query Details" />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-muted-foreground">
                        HASH: {hash}
                    </div>
                    <div className="flex items-start gap-4">
                        <div className="rounded-lg bg-blue-500/10 p-3">
                            <Database className="h-6 w-6 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <h1 className="mb-4 line-clamp-4 cursor-default font-mono text-lg font-bold text-foreground transition-all group-hover:line-clamp-none">
                                {sql}
                            </h1>
                            <div className="flex gap-3">
                                <Badge
                                    variant="outline"
                                    className="border-border bg-muted text-[10px] font-bold text-foreground uppercase"
                                >
                                    {meta?.connection || 'DEFAULT'}
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className="border-border bg-muted text-[10px] font-bold text-muted-foreground uppercase"
                                >
                                    DATABASE: {meta?.database || 'laraowl'}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Individual Calls Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Layers className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(records.total)} Occurrences
                            </span>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full rounded-md border border-border bg-muted py-1.5 pl-8 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                placeholder="Search calls"
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
                                    <TableHead>Source</TableHead>
                                    <TableHead>Location</TableHead>
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
                                                className="rounded-sm border-border bg-muted px-1 py-0 text-[10px] font-bold text-foreground uppercase"
                                            >
                                                {record.payload
                                                    .execution_source || 'APP'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[11px] text-blue-400">
                                                    {record.payload.file
                                                        ? record.payload.file
                                                              .split('/')
                                                              .slice(-3)
                                                              .join('/')
                                                        : 'unknown'}
                                                    :
                                                    {record.payload.line || '?'}
                                                </span>
                                            </div>
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

QueryDetails.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Queries', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
