import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, Mail } from 'lucide-react';
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
import { formatValue } from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function MailShow({
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

    const mailableClass =
        meta?.mailable_class ||
        meta?.class ||
        meta?.mailable ||
        meta?.name ||
        'Unknown Mailable';
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
            <Head title={`Mail - ${mailableClass}`} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="relative flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-card p-6 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 font-mono text-[10px] text-muted-foreground">
                        HASH: {hash}
                    </div>
                    <div className="rounded-lg border border-border bg-muted p-3">
                        <Mail className="h-6 w-6 text-foreground" />
                    </div>
                    <div className="flex-1">
                        <h1
                            className="max-w-4xl truncate font-mono text-xl font-bold text-foreground"
                            title={mailableClass}
                        >
                            {mailableClass}
                        </h1>
                        <div className="mt-1 flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className="border-border bg-muted text-[10px] font-bold text-foreground uppercase"
                            >
                                {meta?.mailer
                                    ? `MAILER: ${meta.mailer.toUpperCase()}`
                                    : 'APP\\MAIL'}
                            </Badge>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                <TableHead>Sent At</TableHead>
                                {isAggregate && (
                                    <TableHead>Application</TableHead>
                                )}
                                <TableHead>Type</TableHead>
                                <TableHead>Recipients</TableHead>
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
                                            className={`text-[10px] font-bold uppercase ${record.payload.queued === 'true' || record.payload.queued === true ? 'bg-blue-500/10 text-blue-400' : 'bg-muted text-foreground/50'} border-none`}
                                        >
                                            {record.payload.queued === 'true' ||
                                            record.payload.queued === true
                                                ? 'QUEUED'
                                                : 'DIRECT'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate font-mono text-xs text-foreground/70">
                                        {formatValue(
                                            record.payload.to ||
                                                record.payload.recipient ||
                                                record.payload.email ||
                                                'Unknown',
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

MailShow.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Mail', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
