import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Zap } from 'lucide-react';
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
import { formatMicroSeconds } from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function JobShow({
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

    const jobClass =
        meta?.name ||
        meta?.job ||
        meta?.job_class ||
        meta?.class ||
        'Unknown Job';
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
            <Head title={`Job - ${jobClass}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                <div className="space-y-2">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                        <Zap className="h-5 w-5 text-orange-500" />
                        <h1
                            className="flex-1 truncate font-mono text-xl font-bold text-foreground"
                            title={jobClass}
                        >
                            {jobClass}
                        </h1>
                        <div className="rounded bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                            HASH: {hash}
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                <TableHead>Execution Time</TableHead>
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
                                            className={`text-[10px] font-bold uppercase ${
                                                record.payload.status ===
                                                'processed'
                                                    ? 'bg-emerald-500/10 text-emerald-500'
                                                    : record.payload.status ===
                                                        'failed'
                                                      ? 'bg-red-500/10 text-red-500'
                                                      : 'bg-orange-500/10 text-orange-500'
                                            } border-none`}
                                        >
                                            {record.payload.status ||
                                                (record.type === 'queued-job'
                                                    ? 'QUEUED'
                                                    : 'STARTED')}
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
        </>
    );
}

JobShow.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Jobs', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
