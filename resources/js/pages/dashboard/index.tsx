import { Head, usePage, Link } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import {
    Activity as ActivityIcon,
    AlertCircle,
    ArrowUpRight,
    LayoutGrid,
    Users as UsersIcon,
    Plus,
    Settings2,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    BarChart,
    Bar,
    Tooltip,
    XAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';
import { appendMonitoringQuery } from '@/lib/monitoring-query';
import { formatMicroSeconds, formatCompactNumber } from '@/lib/utils';

export default function Dashboard({
    total_requests,
    request_breakdown,
    duration_stats,
    total_exceptions,
    timeSeries,
    exceptionTimeSeries,
    job_stats,
    impacted_users,
    active_users,
    auth_users_count,
    guest_users_count,
    uptime_status,
    period,
    from,
    to,
}: any) {
    const { props }: any = usePage();
    const currentProject = props.current_project || props.currentProject;
    const isAggregate = Boolean(currentProject?.is_aggregate);
    const teamSlug = props.current_team?.slug || props.currentTeam?.slug;
    const projectSlug = currentProject?.slug;
    const monitoringHref = (path: string) =>
        appendMonitoringQuery(`/${teamSlug}/${projectSlug}/${path}`, {
            period,
            from,
            to,
        });

    const uptimeEnabled = currentProject?.uptime_monitoring_enabled ?? true;

    useLiveReload(currentProject?.id);

    const exceptionSeries = exceptionTimeSeries?.slice(-20) || [];
    const maxExceptionCount = exceptionSeries.reduce(
        (max: number, d: any) => Math.max(max, d.total || 0),
        0,
    );

    return (
        <>
            <Head title={`Dashboard - ${currentProject?.name}`} />

            <div className="animate-in space-y-12 duration-700 fade-in">
                {/* Section: Health & Setup */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Uptime Status */}
                    <Card className="relative overflow-hidden border-border bg-card shadow-2xl lg:col-span-4">
                        <div
                            className={`absolute top-0 right-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full opacity-20 blur-3xl ${
                                !uptimeEnabled
                                    ? 'bg-muted-foreground'
                                    : isAggregate
                                      ? uptime_status?.down
                                          ? 'bg-red-500'
                                          : 'bg-emerald-500'
                                      : uptime_status?.current === 'up'
                                        ? 'bg-emerald-500'
                                        : 'bg-red-500'
                            }`}
                        />
                        <CardContent className="p-8">
                            <div className="mb-6 flex items-center justify-between">
                                <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                    Availability
                                </div>
                                {!uptimeEnabled ? (
                                    <Badge className="h-5 gap-1.5 border-none bg-muted px-2 text-[9px] font-black text-muted-foreground uppercase">
                                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                                        Disabled
                                    </Badge>
                                ) : isAggregate ? (
                                    <div className="flex items-center gap-1.5">
                                        <Badge className="h-5 gap-1.5 border-none bg-emerald-500/10 px-2 text-[9px] font-black text-emerald-500 uppercase">
                                            <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                                            {uptime_status?.up ?? 0} UP
                                        </Badge>
                                        <Badge className="h-5 gap-1.5 border-none bg-red-500/10 px-2 text-[9px] font-black text-red-500 uppercase">
                                            <span className="size-1.5 rounded-full bg-red-500" />
                                            {uptime_status?.down ?? 0} DOWN
                                        </Badge>
                                    </div>
                                ) : (
                                    <Badge
                                        className={`h-5 gap-1.5 border-none px-2 text-[9px] font-black uppercase ${
                                            uptime_status?.current === 'up'
                                                ? 'bg-emerald-500/10 text-emerald-500'
                                                : uptime_status?.current ===
                                                    'down'
                                                  ? 'bg-red-500/10 text-red-500'
                                                  : 'bg-muted text-muted-foreground'
                                        }`}
                                    >
                                        <span
                                            className={`size-1.5 rounded-full ${uptime_status?.current === 'up' ? 'animate-pulse bg-emerald-500' : 'bg-red-500'}`}
                                        />
                                        {uptime_status?.current ||
                                            'Monitoring...'}
                                    </Badge>
                                )}
                            </div>
                            <div className="mb-2 text-3xl font-black tracking-tighter text-foreground">
                                {!uptimeEnabled
                                    ? 'Monitoring Disabled'
                                    : isAggregate
                                      ? !uptime_status?.up &&
                                        !uptime_status?.down
                                          ? 'Awaiting Data'
                                          : !uptime_status?.down
                                            ? 'All Systems Operational'
                                            : !uptime_status?.up
                                              ? 'Service Disruption'
                                              : `${uptime_status.up} out of ${uptime_status.total} Systems Operational`
                                      : uptime_status?.current === 'up'
                                        ? 'All Systems Operational'
                                        : uptime_status?.current === 'down'
                                          ? 'Service Disruption'
                                          : 'Awaiting Data'}
                            </div>
                            <p className="text-[10px] font-medium tracking-tight text-muted-foreground uppercase">
                                {!uptimeEnabled
                                    ? 'Enable uptime monitoring in project settings'
                                    : uptime_status?.last_check
                                      ? `Last check: ${
                                            isAggregate
                                                ? new Date(
                                                      uptime_status.last_check,
                                                  ).toLocaleString()
                                                : new Date(
                                                      uptime_status.last_check,
                                                  ).toLocaleTimeString()
                                        }`
                                      : 'Configuring monitor...'}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Dynamic Guide or Insights */}
                    {total_requests === 0 ? (
                        <Card className="overflow-hidden border-border bg-card/40 shadow-2xl lg:col-span-8">
                            <CardContent className="flex flex-col items-stretch p-0 md:flex-row">
                                <div className="flex-1 space-y-4 p-8">
                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                        Quick Integration
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-black tracking-tight text-foreground uppercase">
                                            Connect your Laravel app
                                        </h3>
                                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                                            Install the client package to start
                                            receiving real-time monitoring data.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 rounded-lg border border-border/50 bg-muted px-3 py-1.5 font-mono text-[10px] font-bold text-primary">
                                            composer require laraowl/client
                                        </code>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="size-8 rounded-lg"
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    'composer require laraowl/client',
                                                );
                                            }}
                                        >
                                            <ArrowUpRight className="size-3" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-col justify-center gap-4 border-l border-border/50 bg-muted/30 p-8 md:w-64">
                                    <div className="space-y-1">
                                        <div className="text-[9px] font-black text-muted-foreground uppercase">
                                            Your API Token
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <code className="truncate font-mono text-[10px] font-bold opacity-50">
                                                ••••••••••••••••••••••••
                                            </code>
                                        </div>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 rounded-md text-[9px] font-black tracking-widest uppercase"
                                        asChild
                                    >
                                        <Link
                                            href={`/${teamSlug}/${projectSlug}/settings#api`}
                                        >
                                            Configure Token
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden border-border bg-card/40 shadow-2xl lg:col-span-8">
                            <CardContent className="grid grid-cols-1 gap-8 p-8 md:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                        Integration Status
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex size-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                                            <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-black tracking-tight text-foreground uppercase">
                                                Active & Connected
                                            </div>
                                            <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                                                Receiving Data
                                            </div>
                                        </div>
                                    </div>
                                    <p className="pl-10 text-[10px] font-medium text-muted-foreground/60">
                                        Last sync{' '}
                                        {formatDistanceToNow(new Date())} ago
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                        Performance Health
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                                            <ActivityIcon className="size-4 text-primary" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-black tracking-tight text-foreground uppercase">
                                                {duration_stats?.avg < 500
                                                    ? 'System Optimized'
                                                    : 'Latency Detected'}
                                            </div>
                                            <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                                                {formatMicroSeconds(
                                                    duration_stats?.avg,
                                                )}{' '}
                                                Average
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pl-10">
                                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className={`h-full rounded-full ${duration_stats?.avg < 500 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                                                style={{
                                                    width: `${Math.min(100, (duration_stats?.avg / 1000) * 100)}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Section: Activity */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-foreground uppercase">
                            <div className="rounded-md border border-border bg-muted p-1.5">
                                <ActivityIcon className="size-3.5 text-muted-foreground" />
                            </div>
                            Activity
                        </div>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 bg-muted text-[10px] font-black tracking-widest uppercase hover:bg-muted/80"
                        >
                            <Link href={monitoringHref('requests')}>
                                Requests <ArrowUpRight className="size-3" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Requests Card */}
                        <Card className="group overflow-hidden border-border bg-card shadow-2xl">
                            <CardContent className="p-8">
                                <div className="mb-8 flex items-start justify-between">
                                    <div>
                                        <div className="mb-1 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                            Requests
                                        </div>
                                        <div className="text-4xl font-black tracking-tighter text-foreground">
                                            {formatCompactNumber(
                                                total_requests,
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-muted-foreground/30"></span>{' '}
                                                <span className="text-[10px] font-black tracking-tighter text-muted-foreground uppercase">
                                                    1/2/3xx
                                                </span>
                                            </div>
                                            <div className="text-lg font-black text-foreground">
                                                {formatCompactNumber(
                                                    request_breakdown?.ok || 0,
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-orange-500"></span>{' '}
                                                <span className="text-[10px] font-black tracking-tighter text-muted-foreground uppercase">
                                                    4xx
                                                </span>
                                            </div>
                                            <div className="text-lg font-black text-foreground">
                                                {formatCompactNumber(
                                                    request_breakdown?.client_error ||
                                                        0,
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-red-500"></span>{' '}
                                                <span className="text-[10px] font-black tracking-tighter text-muted-foreground uppercase">
                                                    5xx
                                                </span>
                                            </div>
                                            <div className="text-lg font-black text-foreground">
                                                {formatCompactNumber(
                                                    request_breakdown?.server_error ||
                                                        0,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[120px] w-full">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart data={timeSeries}>
                                            <XAxis dataKey="minute" hide />
                                            <Tooltip
                                                content={({
                                                    active,
                                                    payload,
                                                }) => {
                                                    if (
                                                        active &&
                                                        payload &&
                                                        payload.length
                                                    ) {
                                                        return (
                                                            <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                                <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                    {
                                                                        payload[0]
                                                                            .payload
                                                                            .minute
                                                                    }
                                                                </div>
                                                                <div className="grid gap-1">
                                                                    {payload.map(
                                                                        (
                                                                            entry: any,
                                                                            index: number,
                                                                        ) => (
                                                                            <div
                                                                                key={
                                                                                    index
                                                                                }
                                                                                className="flex items-center gap-2"
                                                                            >
                                                                                <div
                                                                                    className="h-2 w-2 rounded-full"
                                                                                    style={{
                                                                                        backgroundColor:
                                                                                            entry.color,
                                                                                    }}
                                                                                />
                                                                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                                    {
                                                                                        entry.name
                                                                                    }

                                                                                    :
                                                                                </span>
                                                                                <span className="text-[10px] font-bold text-foreground">
                                                                                    {formatCompactNumber(
                                                                                        entry.value,
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        ),
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="ok"
                                                name="1/2/3xx"
                                                fill="rgba(255,255,255,0.4)"
                                                radius={[2, 2, 0, 0]}
                                                stackId="a"
                                            />
                                            <Bar
                                                dataKey="client_error"
                                                name="4xx"
                                                fill="#f97316"
                                                radius={[2, 2, 0, 0]}
                                                stackId="a"
                                            />
                                            <Bar
                                                dataKey="server_error"
                                                name="5xx"
                                                fill="#ef4444"
                                                radius={[2, 2, 0, 0]}
                                                stackId="a"
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Duration Card */}
                        <Card className="group overflow-hidden border-border bg-card shadow-2xl">
                            <CardContent className="p-8">
                                <div className="mb-8 flex items-start justify-between">
                                    <div>
                                        <div className="mb-1 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                            Duration
                                        </div>
                                        <div className="text-4xl font-black tracking-tighter text-foreground">
                                            {formatMicroSeconds(
                                                duration_stats?.min,
                                            )}{' '}
                                            -{' '}
                                            {formatMicroSeconds(
                                                duration_stats?.max,
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-6">
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-muted-foreground/30"></span>{' '}
                                                <span className="text-[10px] font-black tracking-tighter text-muted-foreground uppercase">
                                                    Avg
                                                </span>
                                            </div>
                                            <div className="text-lg font-black text-foreground">
                                                {formatMicroSeconds(
                                                    duration_stats?.avg,
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <span className="h-2 w-2 rounded-full bg-orange-500"></span>{' '}
                                                <span className="text-[10px] font-black tracking-tighter text-muted-foreground uppercase">
                                                    P95
                                                </span>
                                            </div>
                                            <div className="text-lg font-black text-foreground">
                                                {formatMicroSeconds(
                                                    duration_stats?.max,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[120px] w-full">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <AreaChart data={timeSeries}>
                                            <defs>
                                                <linearGradient
                                                    id="colorAvg"
                                                    x1="0"
                                                    y1="0"
                                                    x2="0"
                                                    y2="1"
                                                >
                                                    <stop
                                                        offset="5%"
                                                        stopColor="#f97316"
                                                        stopOpacity={0.1}
                                                    />
                                                    <stop
                                                        offset="95%"
                                                        stopColor="#f97316"
                                                        stopOpacity={0}
                                                    />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="minute" hide />
                                            <Tooltip
                                                content={({
                                                    active,
                                                    payload,
                                                }) => {
                                                    if (
                                                        active &&
                                                        payload &&
                                                        payload.length
                                                    ) {
                                                        return (
                                                            <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                                <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                    {
                                                                        payload[0]
                                                                            .payload
                                                                            .minute
                                                                    }
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                        Avg:
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-foreground">
                                                                        {formatMicroSeconds(
                                                                            payload[0]
                                                                                .value,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return null;
                                                }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="avg_duration"
                                                name="Avg Duration"
                                                stroke="#f97316"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorAvg)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Section: Application */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-foreground uppercase">
                            <div className="rounded-md border border-border bg-muted p-1.5">
                                <LayoutGrid className="size-3.5 text-muted-foreground" />
                            </div>
                            Application
                        </div>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 bg-muted text-[10px] font-black tracking-widest uppercase hover:bg-muted/80"
                        >
                            <Link href={monitoringHref('jobs')}>
                                Jobs <ArrowUpRight className="size-3" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Exceptions Overview */}
                        <Card className="relative flex flex-col overflow-hidden border-border bg-card p-6 shadow-2xl lg:col-span-4">
                            <Badge className="mb-6 w-fit border-border bg-muted text-[9px] font-black tracking-widest text-muted-foreground">
                                EXCEPTIONS
                            </Badge>
                            <h3 className="mb-2 text-xl leading-tight font-black tracking-tight text-foreground">
                                {total_exceptions} exceptions reported in the
                                last {period}.
                            </h3>
                            <p className="text-xs font-medium text-muted-foreground">
                                Errors have impacted{' '}
                                {impacted_users?.length || 0} users.
                            </p>

                            <div className="mt-auto pt-8">
                                <div className="mb-8 flex h-[100px] w-full items-end gap-1">
                                    {exceptionSeries.map(
                                        (d: any, i: number) => (
                                            <div
                                                key={i}
                                                className="group relative flex-1 rounded-t-sm bg-red-500/10"
                                                style={{
                                                    height: `${maxExceptionCount > 0 ? Math.min(100, ((d.total || 0) / maxExceptionCount) * 100) : 0}%`,
                                                    minHeight:
                                                        (d.total || 0) > 0
                                                            ? '4px'
                                                            : '2px',
                                                }}
                                            >
                                                {(d.total || 0) > 0 && (
                                                    <div className="absolute inset-0 rounded-t-sm bg-red-500" />
                                                )}
                                            </div>
                                        ),
                                    )}
                                </div>
                                <div className="mb-6 flex items-center gap-4 text-[9px] font-black tracking-widest text-muted-foreground/60 uppercase">
                                    <div className="flex items-center gap-1.5">
                                        <span className="size-1.5 rounded-full bg-muted-foreground/20"></span>{' '}
                                        {total_exceptions > 0
                                            ? 'Analyzing'
                                            : 'All Clear'}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="size-1.5 rounded-full bg-red-500"></span>{' '}
                                        {total_exceptions} Unhandled
                                    </div>
                                </div>
                                <Button
                                    asChild
                                    variant="outline"
                                    className="ml-auto h-8 w-fit self-end border-border bg-muted px-4 text-[10px] font-black tracking-widest uppercase hover:bg-muted/50"
                                >
                                    <Link href={monitoringHref('exceptions')}>
                                        View
                                    </Link>
                                </Button>
                            </div>
                        </Card>

                        {/* Setup Thresholds */}
                        <Card className="group flex cursor-pointer flex-col items-center justify-center border-dashed border-border bg-card p-6 text-center shadow-2xl transition-all hover:border-primary/50 lg:col-span-4">
                            <div className="mb-6 flex size-12 items-center justify-center rounded-xl border border-border bg-muted transition-transform group-hover:scale-110">
                                <Settings2 className="size-6 text-muted-foreground" />
                            </div>
                            <h3 className="mb-2 text-xl font-black tracking-tight text-foreground">
                                Setup thresholds
                            </h3>
                            <p className="mb-8 max-w-[200px] text-xs leading-relaxed text-muted-foreground">
                                Configure your performance thresholds to start
                                monitoring.
                            </p>
                            <Button className="h-9 gap-2 rounded-lg bg-primary px-6 text-[10px] font-black tracking-widest text-primary-foreground uppercase">
                                <Plus className="size-3.5" /> Add Threshold
                            </Button>
                        </Card>

                        {/* Jobs & Durations */}
                        <Card className="flex flex-col divide-y divide-border border-border bg-card shadow-2xl lg:col-span-4">
                            <div className="flex-1 p-6">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                        Jobs
                                    </div>
                                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-2 text-[9px] font-black tracking-widest uppercase">
                                        <div className="flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-red-500"></span>{' '}
                                            Failed{' '}
                                            <span className="ml-1 text-foreground">
                                                {job_stats?.failed || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-emerald-500"></span>{' '}
                                            Processed{' '}
                                            <span className="ml-1 text-foreground">
                                                {job_stats?.processed || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-3xl font-black tracking-tighter text-foreground">
                                    {job_stats?.total || 0}
                                </div>
                            </div>
                            <div className="flex-1 p-6">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                        Job Duration
                                    </div>
                                    <div className="flex gap-4 text-[9px] font-black tracking-widest uppercase">
                                        <div className="flex items-center gap-1.5">
                                            <span className="size-1.5 rounded-full bg-muted-foreground/30"></span>{' '}
                                            Avg{' '}
                                            <span className="ml-1 text-foreground">
                                                {formatMicroSeconds(
                                                    (job_stats?.avg_duration ||
                                                        0) * 1000,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-3xl font-black tracking-tighter text-foreground">
                                    {formatMicroSeconds(
                                        (job_stats?.avg_duration || 0) * 1000,
                                    )}
                                </div>
                            </div>
                        </Card>
                    </div>
                </section>

                {/* Section: Users */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black tracking-widest text-foreground uppercase">
                            <div className="rounded-md border border-border bg-muted p-1.5">
                                <UsersIcon className="size-3.5 text-muted-foreground" />
                            </div>
                            Users
                        </div>
                        <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 bg-muted text-[10px] font-black tracking-widest uppercase hover:bg-muted/80"
                        >
                            <Link href={monitoringHref('users')}>
                                Users <ArrowUpRight className="size-3" />
                            </Link>
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                        {/* Impacted by Exceptions */}
                        <Card className="flex flex-col border-border bg-card p-6 shadow-2xl lg:col-span-4">
                            <Badge className="mb-6 w-fit border-border bg-muted text-[9px] font-black tracking-widest text-muted-foreground">
                                EXCEPTIONS
                            </Badge>
                            <h3 className="mb-8 text-xl leading-tight font-black tracking-tight text-foreground">
                                {impacted_users?.length || 0} user impacted by
                                exceptions in the last {period}.
                            </h3>

                            <div className="mb-8 space-y-2">
                                {impacted_users
                                    ?.slice(0, 1)
                                    .map((u: any, i: number) => (
                                        <div
                                            key={i}
                                            className="group flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3 transition-all hover:border-primary/30"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-black text-foreground uppercase shadow-lg">
                                                    {u.user_identifier.substring(
                                                        0,
                                                        1,
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-black text-foreground">
                                                        {u.user_identifier}
                                                    </div>
                                                    <div className="truncate text-[10px] text-muted-foreground opacity-60">
                                                        {u.user_email ||
                                                            (u.user_id &&
                                                                `ID: ${u.user_id}`)}
                                                    </div>
                                                </div>
                                            </div>
                                            <Badge className="h-5 animate-pulse gap-1 border-none bg-red-500 px-1.5 text-[10px] font-black text-foreground">
                                                <AlertCircle className="size-2.5" />{' '}
                                                {u.error_count}
                                            </Badge>
                                        </div>
                                    ))}
                            </div>

                            <Button
                                asChild
                                variant="outline"
                                className="mt-auto ml-auto h-8 w-fit border-border bg-muted px-4 text-[10px] font-black tracking-widest uppercase hover:bg-muted/50"
                            >
                                <Link href={monitoringHref('users')}>View</Link>
                            </Button>
                        </Card>

                        {/* Most Active Users */}
                        <Card className="flex flex-col border-border bg-card p-6 shadow-2xl lg:col-span-4">
                            <Badge className="mb-6 w-fit border-border bg-muted text-[9px] font-black tracking-widest text-muted-foreground">
                                REQUESTS
                            </Badge>
                            <h3 className="mb-8 text-xl leading-tight font-black tracking-tight text-foreground">
                                Most active users in the last {period}.
                            </h3>

                            <div className="mb-8 space-y-2">
                                {active_users
                                    ?.slice(0, 3)
                                    .map((u: any, i: number) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between rounded-xl border-b border-border/50 p-3 transition-all last:border-none hover:bg-muted/30"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-sm font-black text-foreground">
                                                    {u.user_identifier}
                                                </div>
                                                <div className="truncate text-[10px] text-muted-foreground opacity-60">
                                                    {u.user_email ||
                                                        (u.user_id &&
                                                            `ID: ${u.user_id}`)}
                                                </div>
                                            </div>
                                            <div className="text-xs font-black text-foreground/80">
                                                {u.request_count}
                                            </div>
                                        </div>
                                    ))}
                            </div>

                            <Button
                                asChild
                                variant="outline"
                                className="mt-auto ml-auto h-8 w-fit border-border bg-muted px-4 text-[10px] font-black tracking-widest uppercase hover:bg-muted/50"
                            >
                                <Link href={monitoringHref('users')}>View</Link>
                            </Button>
                        </Card>

                        {/* Auth vs Guest Charts */}
                        <div className="space-y-6 lg:col-span-4">
                            <Card className="border-border bg-card p-6 shadow-2xl">
                                <div className="mb-6 flex items-start justify-between">
                                    <div>
                                        <div className="mb-1 text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                            Authenticated Users
                                        </div>
                                        <div className="text-2xl font-black tracking-tighter text-foreground">
                                            {formatCompactNumber(
                                                auth_users_count,
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[80px] w-full">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart data={timeSeries?.slice(-15)}>
                                            <XAxis dataKey="minute" hide />
                                            <Tooltip
                                                content={({
                                                    active,
                                                    payload,
                                                }) => {
                                                    if (
                                                        active &&
                                                        payload &&
                                                        payload.length
                                                    ) {
                                                        return (
                                                            <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                                <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                    {
                                                                        payload[0]
                                                                            .payload
                                                                            .minute
                                                                    }
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                        Users:
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-foreground">
                                                                        {formatCompactNumber(
                                                                            payload[0]
                                                                                .value,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="active_users"
                                                fill="#10b981"
                                                radius={[1, 1, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="border-border bg-card p-6 shadow-2xl">
                                <div className="mb-6 flex items-start justify-between">
                                    <div>
                                        <div className="mb-1 text-[9px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                            Requests
                                        </div>
                                        <div className="text-2xl font-black tracking-tighter text-foreground">
                                            {formatCompactNumber(
                                                total_requests,
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-[8px] font-black tracking-widest uppercase">
                                        <div className="flex items-center gap-1">
                                            <span className="size-1.5 rounded-full bg-emerald-500"></span>{' '}
                                            Auth{' '}
                                            <span className="text-foreground">
                                                {auth_users_count || 0}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="size-1.5 rounded-full bg-orange-500"></span>{' '}
                                            Guest{' '}
                                            <span className="text-foreground">
                                                {guest_users_count || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-[80px] w-full">
                                    <ResponsiveContainer
                                        width="100%"
                                        height="100%"
                                    >
                                        <BarChart data={timeSeries?.slice(-15)}>
                                            <XAxis dataKey="minute" hide />
                                            <Tooltip
                                                content={({
                                                    active,
                                                    payload,
                                                }) => {
                                                    if (
                                                        active &&
                                                        payload &&
                                                        payload.length
                                                    ) {
                                                        return (
                                                            <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                                <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                                    {
                                                                        payload[0]
                                                                            .payload
                                                                            .minute
                                                                    }
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                        Auth:
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-foreground">
                                                                        {formatCompactNumber(
                                                                            payload[0]
                                                                                .payload
                                                                                .authed,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                                                                    <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                                        Guest:
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-foreground">
                                                                        {formatCompactNumber(
                                                                            payload[0]
                                                                                .payload
                                                                                .guest,
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey="authed"
                                                stackId="requests"
                                                fill="#10b981"
                                            />
                                            <Bar
                                                dataKey="guest"
                                                stackId="requests"
                                                fill="#f59e0b"
                                                radius={[1, 1, 0, 0]}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

Dashboard.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Dashboard', href: '#' }]}
    />
);
