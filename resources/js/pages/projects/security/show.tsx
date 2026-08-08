import { Head, Link, usePage } from '@inertiajs/react';
import {
    Shield,
    ArrowUpRight,
    AlertTriangle,
    Clock,
    Globe,
} from 'lucide-react';
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
import { show as showRecord } from '@/routes/records';

export default function SecurityDetails({
    hash,
    meta,
    records,
}: {
    hash: string;
    meta: any;
    records: any;
}) {
    const { props }: any = usePage();
    const currentProject = props.current_project || props.currentProject;
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const projectSlug = currentProject?.slug;
    const isAggregate = Boolean(currentProject?.is_aggregate);

    const title = meta?.title || 'Security Threat';
    const message = meta?.message || 'No details available';
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
            <Head title={`${title} - Security Details`} />

            <div className="animate-in space-y-12 duration-700 fade-in">
                {/* Header */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 shadow-lg ring-1 ring-red-500/20">
                            <Shield className="h-6 w-6 text-red-500" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-black tracking-tight text-foreground">
                                    {title}
                                </h1>
                                <Badge
                                    variant="destructive"
                                    className="h-5 px-1.5 text-[9px] font-black tracking-widest uppercase"
                                >
                                    Critical
                                </Badge>
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />{' '}
                                    {new Date(
                                        meta.last_seen_at,
                                    ).toLocaleString()}
                                </span>
                                <span>â€¢</span>
                                <span className="flex items-center gap-1 font-mono tracking-normal lowercase">
                                    {hash}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Card className="border-border bg-card shadow-2xl">
                        <CardContent className="p-8">
                            <div className="rounded-lg border border-border/50 bg-black/20 p-4 font-mono text-sm leading-relaxed font-medium text-foreground/90">
                                {message}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Section: Occurrences */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-foreground uppercase">
                            <div className="rounded-md border border-border bg-muted p-1.5">
                                <AlertTriangle className="size-3.5 text-red-500" />
                            </div>
                            {meta.occurrences || records.total || 0} Occurrences
                            Detected
                        </div>
                    </div>

                    <Card className="overflow-hidden border-border bg-card shadow-2xl">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Timestamp
                                    </TableHead>
                                    {isAggregate && (
                                        <TableHead className="py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                            Application
                                        </TableHead>
                                    )}
                                    <TableHead className="py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Source & Details
                                    </TableHead>
                                    <TableHead className="w-[50px] px-6"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {records.data.map((record: any) => (
                                    <TableRow
                                        key={record.id}
                                        className="group border-border transition-colors hover:bg-muted/30"
                                    >
                                        <TableCell className="px-6 py-5 align-top">
                                            <div className="text-[11px] font-black text-foreground">
                                                {new Date(
                                                    record.created_at,
                                                ).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] font-medium text-muted-foreground">
                                                {new Date(
                                                    record.created_at,
                                                ).toLocaleTimeString()}
                                            </div>
                                        </TableCell>
                                        {isAggregate && (
                                            <TableCell className="py-5 align-top text-xs text-muted-foreground">
                                                {record.project?.name || '—'}
                                            </TableCell>
                                        )}
                                        <TableCell className="py-5">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge
                                                        variant="outline"
                                                        className="h-5 gap-1 border-border bg-muted/50 px-2 text-[10px] font-black text-foreground uppercase"
                                                    >
                                                        <Globe className="h-2.5 w-2.5" />
                                                        {record.payload.ip ||
                                                            'Unknown'}
                                                    </Badge>
                                                    {record.payload
                                                        ._security_risk && (
                                                        <Badge
                                                            variant="outline"
                                                            className={`h-5 px-2 text-[9px] font-black uppercase ${
                                                                record.payload
                                                                    ._security_risk ===
                                                                'critical'
                                                                    ? 'border-red-500 bg-red-500/10 text-red-500'
                                                                    : record
                                                                            .payload
                                                                            ._security_risk ===
                                                                        'high'
                                                                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                                                                      : record
                                                                              .payload
                                                                              ._security_risk ===
                                                                          'medium'
                                                                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                                                                        : 'border-blue-500 bg-blue-500/10 text-blue-500'
                                                            }`}
                                                        >
                                                            {
                                                                record.payload
                                                                    ._security_risk
                                                            }{' '}
                                                            Risk (
                                                            {
                                                                record.payload
                                                                    ._security_score
                                                            }
                                                            )
                                                        </Badge>
                                                    )}
                                                    <span className="max-w-md truncate font-mono text-xs text-muted-foreground">
                                                        {record.payload.url ||
                                                            '/'}
                                                    </span>
                                                </div>

                                                {/* Security Threats (Regex hits) */}
                                                {record.payload
                                                    ._security_threats && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {record.payload._security_threats.map(
                                                            (
                                                                t: any,
                                                                i: number,
                                                            ) => (
                                                                <Badge
                                                                    key={i}
                                                                    variant="outline"
                                                                    className="border-red-500/30 bg-red-500/5 px-2 py-0.5 text-[9px] font-black text-red-500 uppercase"
                                                                >
                                                                    {t.type}{' '}
                                                                    {t.detail
                                                                        ? `(${t.detail})`
                                                                        : `â†’ ${t.source}`}
                                                                </Badge>
                                                            ),
                                                        )}
                                                    </div>
                                                )}

                                                {/* Integrity Changes */}
                                                {record.payload
                                                    ._security_changes && (
                                                    <div className="space-y-1.5 rounded-lg border border-border/50 bg-black/20 p-3">
                                                        {record.payload._security_changes.map(
                                                            (
                                                                c: any,
                                                                i: number,
                                                            ) => (
                                                                <div
                                                                    key={i}
                                                                    className="flex items-center gap-3 font-mono text-[10px]"
                                                                >
                                                                    <span
                                                                        className={`font-black uppercase ${
                                                                            c.type ===
                                                                            'modified'
                                                                                ? 'text-orange-400'
                                                                                : c.type ===
                                                                                    'added'
                                                                                  ? 'text-green-400'
                                                                                  : 'text-red-400'
                                                                        }`}
                                                                    >
                                                                        [
                                                                        {c.type}
                                                                        ]
                                                                    </span>
                                                                    <span className="text-muted-foreground">
                                                                        {c.file}
                                                                    </span>
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}

                                                {/* Security Audit Issues */}
                                                {record.payload
                                                    ._security_audit_issues && (
                                                    <div className="flex flex-col gap-2">
                                                        {record.payload._security_audit_issues.map(
                                                            (
                                                                issue: any,
                                                                i: number,
                                                            ) => (
                                                                <div
                                                                    key={i}
                                                                    className="rounded-lg border border-border/50 bg-black/20 p-3"
                                                                >
                                                                    <div className="mb-2 flex items-center gap-2">
                                                                        <Badge
                                                                            variant="outline"
                                                                            className={`px-2 py-0.5 text-[9px] font-black uppercase ${
                                                                                issue.priority ===
                                                                                'critical'
                                                                                    ? 'border-red-500 bg-red-500/10 text-red-500'
                                                                                    : issue.priority ===
                                                                                        'high'
                                                                                      ? 'border-orange-500 bg-orange-500/10 text-orange-500'
                                                                                      : issue.priority ===
                                                                                          'medium'
                                                                                        ? 'border-yellow-500 bg-yellow-500/10 text-yellow-500'
                                                                                        : 'border-blue-500 bg-blue-500/10 text-blue-500'
                                                                            }`}
                                                                        >
                                                                            {
                                                                                issue.type
                                                                            }
                                                                        </Badge>
                                                                    </div>
                                                                    {Array.isArray(
                                                                        issue.details,
                                                                    ) ? (
                                                                        <div className="space-y-1">
                                                                            {issue.details.map(
                                                                                (
                                                                                    d: any,
                                                                                    j: number,
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            j
                                                                                        }
                                                                                        className="flex items-center gap-3 font-mono text-[10px]"
                                                                                    >
                                                                                        {d.type && (
                                                                                            <span
                                                                                                className={`font-black uppercase ${
                                                                                                    d.type ===
                                                                                                    'modified'
                                                                                                        ? 'text-orange-400'
                                                                                                        : d.type ===
                                                                                                            'added'
                                                                                                          ? 'text-green-400'
                                                                                                          : 'text-red-400'
                                                                                                }`}
                                                                                            >
                                                                                                [
                                                                                                {
                                                                                                    d.type
                                                                                                }

                                                                                                ]
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-muted-foreground">
                                                                                            {d.file ||
                                                                                                d.name ||
                                                                                                JSON.stringify(
                                                                                                    d,
                                                                                                )}
                                                                                        </span>
                                                                                    </div>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="font-mono text-[10px] text-muted-foreground">
                                                                            {
                                                                                issue.details
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ),
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-5 align-top">
                                            <Link href={recordHref(record.id)}>
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted transition-all group-hover:border-primary/50 group-hover:bg-primary/5">
                                                    <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                                </div>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <Pagination links={records.links} meta={records} />
                    </Card>
                </section>
            </div>
        </>
    );
}

SecurityDetails.layout = (page: any) => <AppLayout children={page} />;
