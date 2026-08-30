import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowUpRight, X, Terminal, Globe, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { EmptyState } from '@/components/empty-state';
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
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { formatCompactNumber, formatValue } from '@/lib/utils';
import { show as showRecord } from '@/routes/records';

export default function LogsIndex({ records }: { records: any }) {
    const data = records.data || [];
    const { props }: any = usePage();
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const currentProject = props.current_project || props.currentProject;
    const projectSlug =
        props.current_project?.slug || props.currentProject?.slug;

    const isAggregate = Boolean(currentProject?.is_aggregate);

    const [selectedLog, setSelectedLog] = useState<any>(null);
    const recordHref = (record: number) =>
        showRecord.url(
            {
                current_team: teamSlug,
                project: projectSlug,
                record,
            },
            { mergeQuery: {} },
        );

    useLiveReload(currentProject?.id);

    const getLevelColor = (level: string) => {
        const l = level.toLowerCase();

        if (
            l.includes('error') ||
            l.includes('critical') ||
            l.includes('alert') ||
            l.includes('emergency')
        ) {
            return 'text-red-500';
        }

        if (l.includes('warning')) {
            return 'text-orange-500';
        }

        if (l.includes('info')) {
            return 'text-blue-500';
        }

        if (l.includes('debug')) {
            return 'text-purple-500';
        }

        return 'text-muted-foreground';
    };

    return (
        <>
            <Head title="Logs" />

            <div className="mb-8 space-y-4"></div>

            {data.length > 0 ? (
                <>
                    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-border text-[10px] font-bold text-muted-foreground uppercase hover:bg-transparent">
                                    <TableHead>Date</TableHead>
                                    {isAggregate && (
                                        <TableHead>Application</TableHead>
                                    )}
                                    <TableHead>Source</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.map((log: any) => (
                                    <TableRow
                                        key={log.id}
                                        onClick={() => setSelectedLog(log)}
                                        className={`group cursor-pointer border-border transition-colors hover:bg-muted/30 ${selectedLog?.id === log.id ? 'bg-muted/50' : ''}`}
                                    >
                                        <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                                            {new Date(
                                                log.created_at,
                                            ).toLocaleString()}
                                        </TableCell>
                                        {isAggregate && (
                                            <TableCell className="text-xs text-muted-foreground">
                                                {log.project?.name || '—'}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="border-border bg-muted py-0 text-[9px] font-bold text-muted-foreground uppercase"
                                                >
                                                    {log.payload
                                                        .execution_source ||
                                                        'REQUEST'}
                                                </Badge>
                                                <span
                                                    className="truncate font-mono text-[10px] text-muted-foreground uppercase"
                                                    title={`${log.payload.method || ''} ${log.payload.path || log.payload.command || ''}`}
                                                >
                                                    {log.payload.method}{' '}
                                                    {log.payload.path ||
                                                        log.payload.command}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={`border-none bg-transparent text-[10px] font-bold uppercase ${getLevelColor(log.payload.level || 'info')}`}
                                            >
                                                [{log.payload.level || 'INFO'}]
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span
                                                className="block max-w-[400px] truncate text-xs font-medium text-foreground/90"
                                                title={log.payload.message}
                                            >
                                                {log.payload.message}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="rounded border border-transparent p-1 transition-all group-hover:border-border group-hover:bg-muted">
                                                <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination links={records.links} meta={records} />
                </>
            ) : (
                <EmptyState
                    title="No Logs Found"
                    description="We haven't found any application logs matching your filters or for the selected period."
                    icon={FileText}
                />
            )}

            {/* Details Side Panel */}
            {selectedLog && (
                <div className="fixed inset-y-0 right-0 z-50 flex w-[450px] animate-in flex-col border-l border-border bg-[#0f0f0f] shadow-2xl duration-300 slide-in-from-right">
                    <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
                        <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                            {new Date(selectedLog.created_at).toLocaleString()}{' '}
                            UTC
                        </div>
                        <button
                            onClick={() => setSelectedLog(null)}
                            className="rounded p-1 transition-colors hover:bg-white/10"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-8 overflow-y-auto p-6 text-sm">
                        <div className="space-y-2">
                            <div
                                className={`text-xs font-bold uppercase ${getLevelColor(selectedLog.payload.level || 'info')}`}
                            >
                                [{selectedLog.payload.level || 'INFO'}]
                            </div>
                            <h2 className="text-lg leading-relaxed font-medium text-foreground">
                                {selectedLog.payload.message}
                            </h2>
                        </div>

                        <div className="space-y-3">
                            <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                Source
                            </div>
                            <Link
                                href={recordHref(selectedLog.id)}
                                className="group flex items-center justify-between rounded-lg border border-border bg-muted p-3 transition-all hover:border-border"
                            >
                                <div className="flex items-center gap-3">
                                    {selectedLog.payload.execution_source ===
                                    'COMMAND' ? (
                                        <Terminal className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Globe className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span className="font-mono text-xs text-foreground">
                                        {selectedLog.payload
                                            .execution_preview ||
                                            (selectedLog.payload.method
                                                ? `${selectedLog.payload.method} ${selectedLog.payload.path}`
                                                : selectedLog.payload
                                                      .command) ||
                                            'System'}
                                    </span>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="text-[9px] uppercase group-hover:bg-white/10"
                                >
                                    {selectedLog.payload.execution_source ||
                                        'REQUEST'}{' '}
                                    <ArrowUpRight className="ml-1 h-2 w-2" />
                                </Badge>
                            </Link>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                    Log Context
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {formatCompactNumber(
                                        Object.keys(
                                            selectedLog.payload.context || {},
                                        ).length,
                                    )}{' '}
                                    items
                                </div>
                            </div>
                            <div className="text-xs">
                                {(() => {
                                    let context = selectedLog.payload.context;

                                    // Parse if it's a JSON string
                                    if (typeof context === 'string') {
                                        try {
                                            context = JSON.parse(context);
                                        } catch {
                                            // Stay as string if parsing fails
                                        }
                                    }

                                    const jsonString =
                                        typeof context === 'object'
                                            ? JSON.stringify(context, null, 4)
                                            : formatValue(context) ||
                                              'No context provided.';

                                    return (
                                        <SyntaxHighlighter
                                            language="json"
                                            style={vscDarkPlus}
                                            customStyle={{
                                                margin: 0,
                                                borderRadius: '0.5rem',
                                                border: '1px solid hsl(var(--border))',
                                            }}
                                            wrapLines={true}
                                            wrapLongLines={true}
                                        >
                                            {jsonString}
                                        </SyntaxHighlighter>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Backdrop */}
            {selectedLog && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
                    onClick={() => setSelectedLog(null)}
                />
            )}
        </>
    );
}

LogsIndex.layout = (page: any) => (
    <AppLayout children={page} breadcrumbs={[{ title: 'Logs', href: '#' }]} />
);
