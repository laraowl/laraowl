import { Head, usePage } from '@inertiajs/react';
import {
    Activity as ActivityIcon,
    Clock,
    Globe,
    CheckCircle2,
    Timer,
    History,
    RefreshCw,
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLiveReload } from '@/hooks/use-live-reload';
import AppLayout from '@/layouts/app-layout';

export default function UptimeIndex({ checks, uptime_stats, period }: any) {
    const { props }: any = usePage();
    const currentProject = props.current_project || props.currentProject;
    const isAggregate = Boolean(currentProject?.is_aggregate);

    useLiveReload(currentProject?.id);

    if (currentProject && !currentProject.uptime_monitoring_enabled) {
        return (
            <>
                <Head title={`Uptime - ${currentProject?.name}`} />

                <Card className="border-border bg-card p-12 shadow-2xl">
                    <div className="flex flex-col items-center justify-center gap-4 text-center">
                        <Globe className="size-12 text-muted-foreground/30" />
                        <div className="text-2xl font-black tracking-tighter text-foreground">
                            Uptime Monitoring Disabled
                        </div>
                        <p className="max-w-md text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                            Enable it under the project's general settings to
                            start checking availability again.
                        </p>
                    </div>
                </Card>
            </>
        );
    }

    return (
        <>
            <Head title={`Uptime - ${currentProject?.name}`} />

            {/* Stats Overview */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card className="group relative overflow-hidden border-border bg-card p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                        <CheckCircle2 className="size-24 text-emerald-500" />
                    </div>
                    <div className="mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                        Availability
                    </div>
                    <div className="mb-2 text-4xl font-black tracking-tighter text-foreground">
                        {uptime_stats.uptime_percentage}%
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className={`size-2 rounded-full ${uptime_stats.uptime_percentage > 99 ? 'animate-pulse bg-emerald-500' : 'bg-orange-500'}`}
                        ></div>
                        <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                            System Operational
                        </span>
                    </div>
                </Card>

                <Card className="group relative overflow-hidden border-border bg-card p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                        <Timer className="size-24 text-blue-500" />
                    </div>
                    <div className="mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                        Avg Response Time
                    </div>
                    <div className="mb-2 text-4xl font-black tracking-tighter text-foreground">
                        {Math.round(uptime_stats.avg_response_time)}ms
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="size-3 text-muted-foreground/50" />
                        <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                            Last {period}
                        </span>
                    </div>
                </Card>

                <Card className="group relative overflow-hidden border-border bg-card p-8 shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                        <RefreshCw className="size-24 text-primary" />
                    </div>
                    <div className="mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                        Last Check
                    </div>
                    <div className="mb-2 text-xl font-black tracking-tight text-foreground">
                        {uptime_stats.last_check
                            ? new Date(
                                  uptime_stats.last_check.checked_at,
                              ).toLocaleTimeString()
                            : 'Never'}
                    </div>
                    <div className="flex items-center gap-2">
                        <Globe className="size-3 text-muted-foreground/50" />
                        <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                            Global Node
                        </span>
                    </div>
                </Card>
            </div>

            {/* History Chart */}
            <Card className="overflow-hidden border-border bg-card shadow-2xl">
                <div className="border-b border-border/50 p-8">
                    <div className="flex items-center gap-2 text-xs font-black tracking-widest text-foreground uppercase">
                        <ActivityIcon className="size-3.5 text-muted-foreground" />
                        Response Time History
                    </div>
                </div>
                <CardContent className="p-8">
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={checks.data.slice().reverse()}>
                                <defs>
                                    <linearGradient
                                        id="colorResponse"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0.1}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#3b82f6"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (
                                            active &&
                                            payload &&
                                            payload.length
                                        ) {
                                            return (
                                                <div className="rounded-lg border border-border bg-background/95 p-2 shadow-xl backdrop-blur-sm">
                                                    <div className="mb-1.5 border-b border-border/50 pb-1 text-[9px] font-bold tracking-tight text-muted-foreground uppercase">
                                                        {new Date(
                                                            payload[0].payload
                                                                .checked_at,
                                                        ).toLocaleString()}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                        <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                                            Response:
                                                        </span>
                                                        <span className="text-[10px] font-bold text-foreground">
                                                            {payload[0].value}ms
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
                                    dataKey="response_time"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorResponse)"
                                    isAnimationActive={true}
                                    name="Response Time (ms)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Checks Table */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-2 text-xs font-black tracking-widest text-foreground uppercase">
                    <History className="size-3.5 text-muted-foreground" />
                    Check History
                </div>

                <Card className="overflow-hidden border-border bg-card shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    {isAggregate && (
                                        <th className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                            Application
                                        </th>
                                    )}
                                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Response Time
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Status Code
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                        Checked At
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {checks.data.map((check: any) => (
                                    <tr
                                        key={check.id}
                                        className="group transition-colors hover:bg-muted/30"
                                    >
                                        {isAggregate && (
                                            <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                                                {check.project?.name || '—'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {check.status === 'up' ? (
                                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[9px] font-black tracking-widest text-emerald-500 uppercase">
                                                        UP
                                                    </Badge>
                                                ) : (
                                                    <Badge className="border-red-500/20 bg-red-500/10 text-[9px] font-black tracking-widest text-red-500 uppercase">
                                                        DOWN
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-black text-foreground">
                                                {check.response_time}ms
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-muted-foreground">
                                                {check.status_code || '—'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground/60">
                                            {new Date(
                                                check.checked_at,
                                            ).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {checks.links && checks.links.length > 3 && (
                        <div className="flex justify-end gap-2 border-t border-border/50 p-6">
                            {/* Pagination could go here */}
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

UptimeIndex.layout = (page: any) => {
    return (
        <AppLayout
            children={page}
            breadcrumbs={[{ title: 'Uptime Monitoring', href: '#' }]}
        />
    );
};
