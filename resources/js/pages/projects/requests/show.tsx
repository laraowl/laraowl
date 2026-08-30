import { Head, Link, usePage } from '@inertiajs/react';
import { Search, Globe, ArrowUpRight } from 'lucide-react';
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

export default function RequestDetails({
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

    const path = meta?.path || '/';
    const method = meta?.method || 'GET';
    const recordHref = (record: number) =>
        showRecord.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                record,
            },
            { mergeQuery: {} },
        );

    const getStatusColor = (status: number) => {
        if (status >= 500) {
            return 'bg-red-500 text-foreground font-bold px-2 py-0.5 rounded text-[10px]';
        }

        if (status >= 400) {
            return 'bg-orange-500 text-foreground font-bold px-2 py-0.5 rounded text-[10px]';
        }

        return 'bg-emerald-500 text-foreground font-bold px-2 py-0.5 rounded text-[10px]';
    };

    const getMethodColor = (m: string) => {
        switch (m?.toUpperCase()) {
            case 'POST':
                return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'GET':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-muted text-foreground border-border';
        }
    };

    return (
        <>
            <Head title={`Details: ${method} ${path}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Endpoint Info Banner */}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                    <Badge
                        variant="outline"
                        className={`text-[10px] font-bold uppercase ${getMethodColor(method)} border`}
                    >
                        {method}
                    </Badge>
                    <h1 className="font-mono text-lg font-bold tracking-tight text-foreground">
                        {path}
                    </h1>
                    <div className="ml-auto rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                        HASH: {hash}
                    </div>
                </div>

                {/* Individual Logs Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                            <Globe className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {formatCompactNumber(records.total)} Occurrences
                            </span>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                className="w-full rounded-md border border-border bg-muted py-1.5 pl-8 text-sm"
                                placeholder="Search occurrences"
                            />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-[10px] font-bold text-muted-foreground uppercase">
                                        Date
                                    </TableHead>
                                    {isAggregate && (
                                        <TableHead className="text-[10px] font-bold text-muted-foreground uppercase">
                                            Application
                                        </TableHead>
                                    )}
                                    <TableHead className="text-right text-[10px] font-bold text-muted-foreground uppercase">
                                        Status
                                    </TableHead>
                                    <TableHead className="text-right text-[10px] font-bold text-muted-foreground uppercase">
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
                                            ).toLocaleString()}{' '}
                                            UTC
                                        </TableCell>
                                        {isAggregate && (
                                            <TableCell className="text-xs text-muted-foreground">
                                                {record.project?.name || '—'}
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right">
                                            <span
                                                className={getStatusColor(
                                                    record.payload
                                                        .status_code ||
                                                        record.payload.status,
                                                )}
                                            >
                                                {record.payload.status_code ||
                                                    record.payload.status}
                                            </span>
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

RequestDetails.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Requests', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
