import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { formatCompactNumber } from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function ExceptionDetails({
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

    const payload = meta || {};
    const stack = payload.stack || [];
    const firstFrame = stack[0] || {};
    const [expandedFrames, setExpandedFrames] = useState<number[]>([]);
    const recordHref = (record: number) =>
        showRecord.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                record,
            },
            { mergeQuery: {} },
        );

    const toggleFrame = (index: number) => {
        if (expandedFrames.includes(index)) {
            setExpandedFrames(expandedFrames.filter((i) => i !== index));
        } else {
            setExpandedFrames([...expandedFrames, index]);
        }
    };

    return (
        <>
            <Head title={payload.class || 'Exception'} />

            <div className="space-y-8">
                {/* Back Link */}
                <div className="flex items-center gap-2"></div>

                {/* Header Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl leading-tight font-bold tracking-tight text-foreground">
                            {payload.message || 'No Message'}
                        </h1>
                        <div className="flex gap-2">
                            <div className="rounded border border-border bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">
                                HASH: {hash}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Card & Small Chart */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <Card className="border-border bg-card p-6 shadow-2xl lg:col-span-2">
                        <div className="grid grid-cols-1 gap-x-12 gap-y-4 text-sm md:grid-cols-2">
                            <div className="flex items-center justify-between border-b border-border py-2">
                                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Type
                                </span>
                                <span className="font-mono text-xs font-bold text-red-400">
                                    {payload.class}
                                </span>
                            </div>
                            <div className="flex items-center justify-between border-b border-border py-2">
                                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Occurrences
                                </span>
                                <span className="font-mono text-sm text-foreground/90">
                                    {formatCompactNumber(records.total)}
                                </span>
                            </div>
                        </div>
                    </Card>

                    <Card className="relative flex flex-col items-center justify-center overflow-hidden border-border bg-card p-6 shadow-2xl">
                        <Badge className="mb-4 rounded-sm border-none bg-red-500 px-1.5 py-0 text-[10px] font-bold text-foreground uppercase">
                            UNHANDLED
                        </Badge>
                        <div className="text-3xl font-bold text-foreground">
                            {formatCompactNumber(records.total)}
                        </div>
                        <div className="mt-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                            Total Hits
                        </div>
                    </Card>
                </div>

                {/* Code Preview Section */}
                {firstFrame.file && (
                    <Card className="overflow-hidden border-border bg-card font-mono shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border bg-white/[0.03] px-4 py-2">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <span className="max-w-md truncate text-[10px] font-bold text-foreground">
                                    {firstFrame.file}:{firstFrame.line}
                                </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {firstFrame.file?.split('/').slice(-1)}:
                                {firstFrame.line}
                            </span>
                        </div>
                        <div className="bg-background p-0 text-xs">
                            {firstFrame.preview &&
                                Object.entries(firstFrame.preview).map(
                                    ([num, line]: [any, any]) => (
                                        <div
                                            key={num}
                                            className={`flex gap-4 ${num == firstFrame.line ? 'border-l-2 border-red-500 bg-red-500/10' : ''}`}
                                        >
                                            <span className="w-12 py-1 text-right text-muted-foreground/40 select-none">
                                                {num}
                                            </span>
                                            <span
                                                className={`py-1 whitespace-pre ${num == firstFrame.line ? 'font-bold text-foreground' : 'text-muted-foreground/80'}`}
                                            >
                                                {line}
                                            </span>
                                        </div>
                                    ),
                                )}
                        </div>
                    </Card>
                )}

                {/* Stack Trace */}
                {stack.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold tracking-widest text-foreground uppercase">
                            Stack Trace
                        </h3>
                        <div className="space-y-2">
                            {stack.map((frame: any, index: number) => (
                                <div
                                    key={index}
                                    className="overflow-hidden rounded border border-border bg-card"
                                >
                                    <div
                                        className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-muted/30"
                                        onClick={() => toggleFrame(index)}
                                    >
                                        <div className="flex items-center gap-3 font-mono text-xs">
                                            <span className="text-muted-foreground/50">
                                                #{stack.length - index}
                                            </span>
                                            <span className="text-blue-400">
                                                {frame.class}
                                                {frame.type}
                                                {frame.function}()
                                            </span>
                                        </div>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            {frame.file
                                                ?.split('/')
                                                .slice(-2)
                                                .join('/')}
                                            :{frame.line}
                                        </span>
                                    </div>
                                    {expandedFrames.includes(index) &&
                                        frame.preview && (
                                            <div className="border-t border-border bg-background p-4 font-mono text-xs">
                                                {Object.entries(
                                                    frame.preview,
                                                ).map(
                                                    ([num, line]: [
                                                        any,
                                                        any,
                                                    ]) => (
                                                        <div
                                                            key={num}
                                                            className={`flex gap-4 ${num == frame.line ? 'bg-red-500/10' : ''}`}
                                                        >
                                                            <span className="w-12 py-0.5 text-right text-muted-foreground/40">
                                                                {num}
                                                            </span>
                                                            <span
                                                                className={`py-0.5 whitespace-pre ${num == frame.line ? 'text-foreground' : 'text-muted-foreground/60'}`}
                                                            >
                                                                {line}
                                                            </span>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Occurrences Table */}
                <div className="space-y-4 pt-8">
                    <h3 className="flex items-center gap-2 text-xs font-bold tracking-widest text-foreground uppercase">
                        <ChevronDown className="h-3 w-3" />
                        {formatCompactNumber(records.total)} Occurrences
                    </h3>
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                    <TableHead>Date</TableHead>
                                    {isAggregate && (
                                        <TableHead>Application</TableHead>
                                    )}
                                    <TableHead>Environment</TableHead>
                                    <TableHead className="text-right">
                                        User
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
                                                className="border-border bg-muted text-[10px] font-bold text-foreground uppercase"
                                            >
                                                {record.payload.method ||
                                                    'COMMAND'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">
                                            Guest
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

ExceptionDetails.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[
            { title: 'Exceptions', href: '#' },
            { title: 'Details', href: '#' },
        ]}
    />
);
