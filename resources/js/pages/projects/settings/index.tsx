import { Head, usePage, useForm, router } from '@inertiajs/react';

import {
    Zap,
    Plus,
    Trash2,
    Settings2,
    Bell,
    ShieldAlert,
    Loader2,
    Play,
    Globe,
    MessageSquare,
    Send,
    Mail,
    Copy,
    Pencil,
    Terminal,
    Clock,
    AlertCircle,
    Info,
    Lock,
} from 'lucide-react';

import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import type { SharedData } from '@/types';

const iconMap: any = {
    slack: MessageSquare,
    discord: MessageSquare,
    webhook: Globe,
    telegram: Send,
    email: Mail,
    gotify: MessageSquare,
};

export default function ProjectSettings({
    project,
    integrations,
    alert_rules,
    available_types,
}: any) {
    const { props } = usePage<SharedData>();
    const teamSlug = props.currentTeam?.slug || '';

    const projectSlug = project.slug;

    // Integration Form
    const [isAddIntegrationOpen, setIsAddIntegrationOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<any>(null);
    const [editingIntegration, setEditingIntegration] = useState<any>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const intForm = useForm({
        name: '',
        type: '',
        data: {} as any,
        is_enabled: true,
    });

    // Alert Rule Form
    const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const ruleForm = useForm({
        name: '',
        event_type: 'new_exception',
        integration_ids: [] as number[],
        settings: {
            occurrence_threshold: 1,
            time_window: 10,
            throttle_period: 3600,
        },
        is_enabled: true,
    });

    // General Settings Form
    const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const generalForm = useForm({
        name: project.name,
        url: project.url || '',
        uptime_monitoring_enabled: project.uptime_monitoring_enabled ?? true,
        uptime_check_interval: project.uptime_check_interval || 60,
        retention_days: project.retention_days || 7,
        logo: null as File | null,
        _method: 'PATCH', // For file uploads with PATCH
    });

    // Cloudflare Form
    const cloudflareForm = useForm({
        api_token: project.settings?.cloudflare?.api_token || '',
        zone_id: project.settings?.cloudflare?.zone_id || '',
    });

    const [activeTab, setActiveTab] = useState(() => {
        if (typeof window !== 'undefined') {
            const hash = window.location.hash.replace('#', '');

            if (
                hash &&
                [
                    'general',
                    'integrations',
                    'alerts',
                    'api',
                    'cloudflare',
                    'thresholds',
                ].includes(hash)
            ) {
                return hash;
            }
        }

        return 'general';
    });

    const handleUpdateCloudflare = (e: React.FormEvent) => {
        e.preventDefault();
        cloudflareForm.patch(`/${teamSlug}/${projectSlug}/cloudflare`, {
            onSuccess: () => toast.success('Cloudflare settings updated'),
        });
    };

    const handleUpdateProject = (e: React.FormEvent) => {
        e.preventDefault();
        generalForm.post(`/${teamSlug}/${projectSlug}`, {
            forceFormData: true,
            onSuccess: () => toast.success('Project updated successfully'),
        });
    };

    const handleDeleteProject = () => {
        generalForm.delete(`/${teamSlug}/${projectSlug}`, {
            onSuccess: () => {
                setIsDeleteProjectOpen(false);
                toast.success('Project deleted');
            },
        });
    };

    // Threshold Dialog States
    const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
    const [isAddJobOpen, setIsAddJobOpen] = useState(false);
    const [isAddCommandOpen, setIsAddCommandOpen] = useState(false);
    const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
    const [isAddQueryOpen, setIsAddQueryOpen] = useState(false);

    const handleAddIntegration = (e: React.FormEvent) => {
        e.preventDefault();
        const url = editingIntegration
            ? `/${teamSlug}/${projectSlug}/integrations/${editingIntegration.id}`
            : `/${teamSlug}/${projectSlug}/integrations`;

        const method = editingIntegration ? 'patch' : 'post';

        intForm[method](url, {
            onSuccess: () => {
                setIsAddIntegrationOpen(false);
                setEditingIntegration(null);
                setSelectedType(null);
                intForm.reset();
                toast.success(
                    editingIntegration
                        ? 'Integration updated'
                        : 'Integration added',
                );
            },
        });
    };

    const handleEditIntegration = (int: any) => {
        const type = available_types?.find((t: any) => t.id === int.type);
        setEditingIntegration(int);
        setSelectedType(type);
        intForm.setData({
            name: int.name,
            type: int.type,
            data: int.data || {},
            is_enabled: int.is_enabled,
        });
        setIsAddIntegrationOpen(true);
    };

    const handleAddRule = (e: React.FormEvent) => {
        e.preventDefault();
        const url = editingRule
            ? `/${teamSlug}/${projectSlug}/alerts/${editingRule.id}`
            : `/${teamSlug}/${projectSlug}/alerts`;

        const method = editingRule ? 'patch' : 'post';

        ruleForm[method](url, {
            onSuccess: () => {
                setIsAddRuleOpen(false);
                setEditingRule(null);
                ruleForm.reset();
                toast.success(
                    editingRule ? 'Alert rule updated' : 'Alert rule created',
                );
            },
        });
    };

    const handleEditRule = (rule: any) => {
        setEditingRule(rule);
        ruleForm.setData({
            name: rule.name,
            event_type: rule.event_type,
            settings: {
                occurrence_threshold: rule.settings?.occurrence_threshold || 1,
                time_window: rule.settings?.time_window || 10,
                throttle_period: rule.settings?.throttle_period || 3600,
            },
            integration_ids: rule.integrations.map((i: any) => i.id),
            is_enabled: rule.is_enabled,
        });
        setIsAddRuleOpen(true);
    };

    const handleTestIntegration = (id: number) => {
        setTestingId(id);
        intForm.post(`/${teamSlug}/${projectSlug}/integrations/${id}/test`, {
            onSuccess: () => {
                toast.success('Connection verified successfully!');
                setTestingId(null);
            },
            onError: (err) => {
                toast.error('Connection failed: ' + Object.values(err)[0]);
                setTestingId(null);
            },
            onFinish: () => setTestingId(null),
        });
    };

    const handleDeleteIntegration = (id: number) => {
        if (confirm('Are you sure you want to delete this integration?')) {
            intForm.delete(`/${teamSlug}/${projectSlug}/integrations/${id}`, {
                onSuccess: () => toast.success('Integration deleted'),
            });
        }
    };

    const handleDeleteRule = (id: number) => {
        if (confirm('Are you sure you want to delete this alert rule?')) {
            ruleForm.delete(`/${teamSlug}/${projectSlug}/alerts/${id}`, {
                onSuccess: () => toast.success('Alert rule deleted'),
            });
        }
    };

    return (
        <>
            <Head title="Project Settings" />

            <div className="animate-in space-y-8 duration-700 fade-in">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground">
                        Project Settings
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Manage your project configuration, integrations, and
                        alerts.
                    </p>
                </div>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full"
                >
                    <TabsList className="mb-8 rounded-xl bg-muted p-1">
                        <TabsTrigger
                            value="general"
                            className="rounded-lg px-6"
                        >
                            General
                        </TabsTrigger>
                        <TabsTrigger
                            value="integrations"
                            className="rounded-lg px-6"
                        >
                            Integrations
                        </TabsTrigger>
                        <TabsTrigger value="alerts" className="rounded-lg px-6">
                            Alert Rules
                        </TabsTrigger>
                        <TabsTrigger
                            value="thresholds"
                            className="rounded-lg px-6"
                        >
                            Thresholds
                        </TabsTrigger>
                        <TabsTrigger value="api" className="rounded-lg px-6">
                            API Keys
                        </TabsTrigger>
                        <TabsTrigger
                            value="cloudflare"
                            id="cloudflare"
                            className="rounded-lg px-6"
                        >
                            Cloudflare
                        </TabsTrigger>
                    </TabsList>

                    {/* Thresholds */}
                    <TabsContent value="thresholds" className="space-y-6">
                        <Card className="border-border bg-card p-8 shadow-2xl">
                            <Badge className="mb-6 w-fit border-border bg-muted text-[9px] font-black tracking-widest text-muted-foreground uppercase">
                                Setting up thresholds
                            </Badge>
                            <h3 className="mb-2 text-xl font-black tracking-tight text-foreground">
                                Setting up thresholds
                            </h3>
                            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                                Monitor application-wide performance by setting
                                custom response time thresholds. Events running
                                longer than your specified thresholds will
                                trigger automatic issues and notifications.
                            </p>
                        </Card>

                        {/* Routes Thresholds */}
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Routes
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {project.thresholds
                                    ?.filter((t: any) => t.type === 'route')
                                    .map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Globe className="h-4 w-4 text-blue-400" />
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {t.key}
                                                    </div>
                                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Threshold: {t.value}ms
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Delete this threshold?',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/${teamSlug}/${projectSlug}/thresholds/${t.id}`,
                                                        );
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                <Dialog
                                    open={isAddRouteOpen}
                                    onOpenChange={setIsAddRouteOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-dashed border-border py-8 text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                            threshold
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-border bg-background text-foreground">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Add Route Threshold
                                            </DialogTitle>
                                        </DialogHeader>
                                        <ThresholdForm
                                            type="route"
                                            teamSlug={teamSlug}
                                            projectSlug={projectSlug}
                                            onSuccess={() =>
                                                setIsAddRouteOpen(false)
                                            }
                                        />
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* Jobs Thresholds */}
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Jobs
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {project.thresholds
                                    ?.filter((t: any) => t.type === 'job')
                                    .map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Zap className="h-4 w-4 text-emerald-400" />
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {t.key}
                                                    </div>
                                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Threshold: {t.value}ms
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Delete this threshold?',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/${teamSlug}/${projectSlug}/thresholds/${t.id}`,
                                                        );
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                <Dialog
                                    open={isAddJobOpen}
                                    onOpenChange={setIsAddJobOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-dashed border-border py-8 text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                            threshold
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-border bg-background text-foreground">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Add Job Threshold
                                            </DialogTitle>
                                        </DialogHeader>
                                        <ThresholdForm
                                            type="job"
                                            teamSlug={teamSlug}
                                            projectSlug={projectSlug}
                                            onSuccess={() =>
                                                setIsAddJobOpen(false)
                                            }
                                        />
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* Commands Thresholds */}
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Commands
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {project.thresholds
                                    ?.filter((t: any) => t.type === 'command')
                                    .map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Terminal className="h-4 w-4 text-orange-400" />
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {t.key}
                                                    </div>
                                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Threshold: {t.value}ms
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Delete this threshold?',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/${teamSlug}/${projectSlug}/thresholds/${t.id}`,
                                                        );
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                <Dialog
                                    open={isAddCommandOpen}
                                    onOpenChange={setIsAddCommandOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-dashed border-border py-8 text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                            threshold
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-border bg-background text-foreground">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Add Command Threshold
                                            </DialogTitle>
                                        </DialogHeader>
                                        <ThresholdForm
                                            type="command"
                                            teamSlug={teamSlug}
                                            projectSlug={projectSlug}
                                            onSuccess={() =>
                                                setIsAddCommandOpen(false)
                                            }
                                        />
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* Scheduled Tasks Thresholds */}
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Scheduled Tasks
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {project.thresholds
                                    ?.filter(
                                        (t: any) => t.type === 'scheduled-task',
                                    )
                                    .map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Clock className="h-4 w-4 text-purple-400" />
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {t.key}
                                                    </div>
                                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Threshold: {t.value}ms
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Delete this threshold?',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/${teamSlug}/${projectSlug}/thresholds/${t.id}`,
                                                        );
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                <Dialog
                                    open={isAddTaskOpen}
                                    onOpenChange={setIsAddTaskOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-dashed border-border py-8 text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                            threshold
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-border bg-background text-foreground">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Add Task Threshold
                                            </DialogTitle>
                                        </DialogHeader>
                                        <ThresholdForm
                                            type="scheduled-task"
                                            teamSlug={teamSlug}
                                            projectSlug={projectSlug}
                                            onSuccess={() =>
                                                setIsAddTaskOpen(false)
                                            }
                                        />
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>

                        {/* Queries Thresholds */}
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-lg font-bold text-foreground">
                                    Database Queries
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {project.thresholds
                                    ?.filter((t: any) => t.type === 'query')
                                    .map((t: any) => (
                                        <div
                                            key={t.id}
                                            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Globe className="h-4 w-4 text-cyan-400" />
                                                <div>
                                                    <div className="max-w-md truncate text-sm font-bold text-foreground">
                                                        {t.key}
                                                    </div>
                                                    <div className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Threshold: {t.value}ms
                                                    </div>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-red-500 hover:bg-red-500/10"
                                                onClick={() => {
                                                    if (
                                                        confirm(
                                                            'Delete this threshold?',
                                                        )
                                                    ) {
                                                        router.delete(
                                                            `/${teamSlug}/${projectSlug}/thresholds/${t.id}`,
                                                        );
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                <Dialog
                                    open={isAddQueryOpen}
                                    onOpenChange={setIsAddQueryOpen}
                                >
                                    <DialogTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="w-full gap-2 border-dashed border-border py-8 text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                                        >
                                            <Plus className="h-4 w-4" /> Add
                                            threshold
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="border-border bg-background text-foreground">
                                        <DialogHeader>
                                            <DialogTitle>
                                                Add Query Threshold
                                            </DialogTitle>
                                        </DialogHeader>
                                        <ThresholdForm
                                            type="query"
                                            teamSlug={teamSlug}
                                            projectSlug={projectSlug}
                                            onSuccess={() =>
                                                setIsAddQueryOpen(false)
                                            }
                                        />
                                    </DialogContent>
                                </Dialog>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* API Keys */}

                    {/* General Settings */}
                    <TabsContent value="general">
                        <div className="space-y-6">
                            <Card className="border-border bg-card shadow-2xl">
                                <CardHeader>
                                    <CardTitle className="text-foreground">
                                        General Information
                                    </CardTitle>
                                    <CardDescription>
                                        Update your project details and icon.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <form
                                        onSubmit={handleUpdateProject}
                                        className="space-y-6"
                                    >
                                        <div className="flex flex-col gap-8 md:flex-row">
                                            {/* Logo Upload */}
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="group relative">
                                                    <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-border bg-muted ring-primary ring-offset-background transition-all group-hover:ring-2">
                                                        {project.logo_url ||
                                                        generalForm.data
                                                            .logo ? (
                                                            <img
                                                                src={
                                                                    generalForm
                                                                        .data
                                                                        .logo
                                                                        ? URL.createObjectURL(
                                                                              generalForm
                                                                                  .data
                                                                                  .logo as any,
                                                                          )
                                                                        : project.logo_url
                                                                }
                                                                className="h-full w-full object-cover"
                                                                alt="Project Logo"
                                                            />
                                                        ) : (
                                                            <Zap className="h-12 w-12 text-muted-foreground/50" />
                                                        )}
                                                        <div
                                                            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                                                            onClick={() =>
                                                                document
                                                                    .getElementById(
                                                                        'logo-upload',
                                                                    )
                                                                    ?.click()
                                                            }
                                                        >
                                                            <Plus className="h-8 w-8 text-white" />
                                                        </div>
                                                    </div>
                                                    <input
                                                        id="logo-upload"
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file =
                                                                e.target
                                                                    .files?.[0];

                                                            if (file) {
                                                                generalForm.setData(
                                                                    'logo',
                                                                    file,
                                                                );
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                    Project Icon
                                                </p>
                                                {generalForm.errors.logo && (
                                                    <p className="text-[10px] font-bold text-red-500">
                                                        {
                                                            generalForm.errors
                                                                .logo
                                                        }
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex-1 space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Project Name</Label>
                                                    <Input
                                                        value={
                                                            generalForm.data
                                                                .name
                                                        }
                                                        onChange={(e) =>
                                                            generalForm.setData(
                                                                'name',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="h-11 rounded-xl border-border bg-muted"
                                                        placeholder="My Awesome App"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Project URL</Label>
                                                    <Input
                                                        value={
                                                            generalForm.data.url
                                                        }
                                                        onChange={(e) =>
                                                            generalForm.setData(
                                                                'url',
                                                                e.target.value,
                                                            )
                                                        }
                                                        className="h-11 rounded-xl border-border bg-muted"
                                                        placeholder="https://example.com"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted px-4 py-3">
                                                    <Label>
                                                        Uptime Monitoring
                                                    </Label>
                                                    <Switch
                                                        checked={
                                                            generalForm.data
                                                                .uptime_monitoring_enabled
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            generalForm.setData(
                                                                'uptime_monitoring_enabled',
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                </div>
                                                {generalForm.data
                                                    .uptime_monitoring_enabled && (
                                                    <div className="space-y-2">
                                                        <Label>
                                                            Uptime Check
                                                            Interval
                                                        </Label>
                                                        <Select
                                                            value={String(
                                                                generalForm.data
                                                                    .uptime_check_interval,
                                                            )}
                                                            onValueChange={(
                                                                val,
                                                            ) =>
                                                                generalForm.setData(
                                                                    'uptime_check_interval',
                                                                    parseInt(
                                                                        val,
                                                                    ),
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger className="h-11 rounded-xl border-border bg-muted">
                                                                <SelectValue placeholder="Select interval" />
                                                            </SelectTrigger>
                                                            <SelectContent className="border-border bg-popover">
                                                                <SelectItem value="30">
                                                                    30 Seconds
                                                                </SelectItem>
                                                                <SelectItem value="60">
                                                                    1 Minute
                                                                    (Default)
                                                                </SelectItem>
                                                                <SelectItem value="120">
                                                                    2 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="180">
                                                                    3 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="300">
                                                                    5 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="600">
                                                                    10 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="900">
                                                                    15 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="1800">
                                                                    30 Minutes
                                                                </SelectItem>
                                                                <SelectItem value="3600">
                                                                    1 Hour
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                                            Frequency of
                                                            availability checks.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <Label>
                                                        Data Retention Period
                                                    </Label>
                                                    <Select
                                                        value={String(
                                                            generalForm.data
                                                                .retention_days,
                                                        )}
                                                        onValueChange={(val) =>
                                                            generalForm.setData(
                                                                'retention_days',
                                                                parseInt(val),
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="h-11 rounded-xl border-border bg-muted">
                                                            <SelectValue placeholder="Select retention period" />
                                                        </SelectTrigger>
                                                        <SelectContent className="border-border bg-popover">
                                                            <SelectItem value="1">
                                                                1 Day
                                                            </SelectItem>
                                                            <SelectItem value="3">
                                                                3 Days
                                                            </SelectItem>
                                                            <SelectItem value="7">
                                                                7 Days (Default)
                                                            </SelectItem>
                                                            <SelectItem value="14">
                                                                14 Days
                                                            </SelectItem>
                                                            <SelectItem value="30">
                                                                30 Days
                                                            </SelectItem>
                                                            <SelectItem value="60">
                                                                60 Days
                                                            </SelectItem>
                                                            <SelectItem value="90">
                                                                90 Days
                                                            </SelectItem>
                                                            <SelectItem value="0">
                                                                Never Delete
                                                                (Not
                                                                Recommended)
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">
                                                        Records older than this
                                                        will be permanently
                                                        deleted.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end border-t border-border pt-4">
                                            <Button
                                                disabled={
                                                    generalForm.processing
                                                }
                                                className="h-10 rounded-xl bg-primary px-8 text-[10px] font-black tracking-widest text-primary-foreground uppercase shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                                            >
                                                {generalForm.processing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Save Changes'
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Danger Zone</CardTitle>
                                    <CardDescription>
                                        Permanently delete this project and all
                                        its monitoring data. This action is
                                        irreversible.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Dialog
                                        open={isDeleteProjectOpen}
                                        onOpenChange={setIsDeleteProjectOpen}
                                    >
                                        <DialogTrigger asChild>
                                            <Button
                                                variant="destructive"
                                                className="h-10 rounded-xl bg-red-500/10 px-8 text-[10px] font-black tracking-widest text-red-500 uppercase transition-all hover:bg-red-500 hover:text-white"
                                            >
                                                Delete Project
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="border-border bg-background text-foreground">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2 text-red-500">
                                                    <ShieldAlert className="h-5 w-5" />{' '}
                                                    Delete Project?
                                                </DialogTitle>
                                                <DialogDescription className="pt-4 text-muted-foreground">
                                                    This will permanently delete{' '}
                                                    <span className="font-bold text-foreground">
                                                        "{project.name}"
                                                    </span>{' '}
                                                    and all its records, issues,
                                                    and settings. Please type{' '}
                                                    <span className="rounded bg-red-500/10 px-1 font-mono text-red-500">
                                                        {project.slug}
                                                    </span>{' '}
                                                    to confirm.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <Input
                                                    value={deleteConfirm}
                                                    onChange={(e) =>
                                                        setDeleteConfirm(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={project.slug}
                                                    className="border-red-500/20 bg-muted focus-visible:ring-red-500"
                                                />
                                                <Button
                                                    variant="destructive"
                                                    className="h-11 w-full text-[10px] font-black tracking-widest uppercase"
                                                    disabled={
                                                        deleteConfirm !==
                                                        project.slug
                                                    }
                                                    onClick={
                                                        handleDeleteProject
                                                    }
                                                >
                                                    Permanently Delete Project
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* Integrations */}
                    <TabsContent value="integrations" className="space-y-12">
                        <Dialog
                            open={isAddIntegrationOpen}
                            onOpenChange={(open) => {
                                setIsAddIntegrationOpen(open);

                                if (!open) {
                                    setEditingIntegration(null);
                                    setSelectedType(null);
                                    intForm.reset();
                                }
                            }}
                        >
                            <Tabs defaultValue="marketplace" className="w-full">
                                <div className="mb-8 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight text-foreground">
                                            Integrations
                                        </h2>
                                        <p className="mt-1 text-xs font-medium text-muted-foreground">
                                            Connect your favorite tools to
                                            receive instant alerts.
                                        </p>
                                    </div>
                                    <TabsList className="rounded-xl border border-border bg-muted p-1">
                                        <TabsTrigger
                                            value="marketplace"
                                            className="h-9 rounded-lg px-6 text-[10px] font-black tracking-widest uppercase"
                                        >
                                            Marketplace
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="configurations"
                                            className="h-9 rounded-lg px-6 text-[10px] font-black tracking-widest uppercase"
                                        >
                                            Configurations
                                            {(integrations?.length || 0) >
                                                0 && (
                                                <Badge className="ml-2 h-4 border-none bg-primary/20 px-1 text-[8px] text-primary">
                                                    {integrations.length}
                                                </Badge>
                                            )}
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                <TabsContent value="marketplace">
                                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {[
                                            {
                                                id: 'slack',
                                                name: 'Slack',
                                                desc: 'Send interactive alerts to your Slack workspace.',
                                                color: 'from-orange-500/20 to-pink-500/20',
                                                icon: MessageSquare,
                                            },
                                            {
                                                id: 'discord',
                                                name: 'Discord',
                                                desc: 'Send alerts to your Discord server using a webhook.',
                                                color: 'from-indigo-500/20 to-blue-500/20',
                                                icon: Send,
                                            },
                                            {
                                                id: 'telegram',
                                                name: 'Telegram',
                                                desc: 'Send alerts to your Telegram chat bot.',
                                                color: 'from-sky-500/20 to-blue-500/20',
                                                icon: Globe,
                                            },
                                            {
                                                id: 'webhook',
                                                name: 'Webhook',
                                                desc: 'Send a payload to any HTTP endpoint.',
                                                color: 'from-emerald-500/20 to-teal-500/20',
                                                icon: Zap,
                                            },
                                            {
                                                id: 'email',
                                                name: 'Email',
                                                desc: 'Send an email to any address.',
                                                color: 'from-purple-500/20 to-indigo-500/20',
                                                icon: Mail,
                                            },
                                            {
                                                id: 'gotify',
                                                name: 'Gotify',
                                                desc: 'Push alerts to your self-hosted Gotify server.',
                                                color: 'from-lime-500/20 to-green-500/20',
                                                icon: Bell,
                                            },
                                        ].map((item) => {
                                            const isConfigured =
                                                integrations?.some(
                                                    (int: any) =>
                                                        int.type === item.id,
                                                );

                                            return (
                                                <Card
                                                    key={item.id}
                                                    className="group relative overflow-hidden border-border bg-card shadow-2xl transition-all duration-500 hover:border-primary/50"
                                                >
                                                    {/* Glow Effect */}
                                                    <div
                                                        className={`absolute -top-10 -left-10 h-32 w-32 bg-gradient-to-br ${item.color} opacity-50 blur-[60px] transition-opacity group-hover:opacity-100`}
                                                    />

                                                    <CardContent className="relative z-10 p-8">
                                                        <div className="mb-6 flex items-start justify-between">
                                                            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted shadow-inner transition-transform duration-500 group-hover:scale-110">
                                                                <item.icon className="h-7 w-7 text-primary" />
                                                            </div>
                                                            <Button
                                                                variant="outline"
                                                                className="h-8 rounded-lg border-border text-[10px] font-black tracking-widest uppercase transition-all hover:bg-primary hover:text-primary-foreground"
                                                                onClick={() => {
                                                                    const type: any =
                                                                        available_types?.find(
                                                                            (
                                                                                t: any,
                                                                            ) =>
                                                                                t.id ===
                                                                                item.id,
                                                                        );

                                                                    if (type) {
                                                                        setSelectedType(
                                                                            type,
                                                                        );
                                                                        intForm.setData(
                                                                            {
                                                                                type: type.id,
                                                                                name: type.name,
                                                                                data:
                                                                                    type.id ===
                                                                                    'email'
                                                                                        ? {
                                                                                              email: props
                                                                                                  .auth
                                                                                                  .user
                                                                                                  .email,
                                                                                          }
                                                                                        : {},
                                                                            },
                                                                        );
                                                                        setIsAddIntegrationOpen(
                                                                            true,
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                {isConfigured
                                                                    ? 'Add More'
                                                                    : 'Install'}
                                                            </Button>
                                                        </div>
                                                        <div>
                                                            <h3 className="mb-2 text-xl font-black text-foreground">
                                                                {item.name}
                                                            </h3>
                                                            <p className="text-xs leading-relaxed font-medium text-muted-foreground">
                                                                {item.desc}
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </TabsContent>

                                <TabsContent value="configurations">
                                    {integrations.length > 0 ? (
                                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                            {integrations.map((int: any) => {
                                                const Icon =
                                                    iconMap[int.type] || Zap;

                                                return (
                                                    <Card
                                                        key={int.id}
                                                        className="group border-border bg-card transition-all hover:bg-muted/30"
                                                    >
                                                        <CardContent className="p-5">
                                                            <div className="mb-4 flex items-center gap-3">
                                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
                                                                    <Icon className="h-5 w-5 text-primary" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="truncate text-sm font-bold text-foreground">
                                                                            {
                                                                                int.name
                                                                            }
                                                                        </h3>
                                                                        {int.status ===
                                                                            'failing' && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger>
                                                                                        <AlertCircle className="h-3.5 w-3.5 animate-pulse text-red-500" />
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent className="border-none bg-red-500 text-[10px] text-white">
                                                                                        {int.last_error ||
                                                                                            'Connection failed'}
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                                        {
                                                                            int.type
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <Badge
                                                                    className={
                                                                        int.is_enabled
                                                                            ? int.status ===
                                                                              'failing'
                                                                                ? 'border-none bg-red-500/10 text-red-500'
                                                                                : 'border-none bg-emerald-500/10 text-emerald-500'
                                                                            : 'border-none bg-muted text-muted-foreground'
                                                                    }
                                                                >
                                                                    {int.is_enabled
                                                                        ? int.status ===
                                                                          'failing'
                                                                            ? 'Failing'
                                                                            : 'Healthy'
                                                                        : 'Off'}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    disabled={
                                                                        testingId ===
                                                                        int.id
                                                                    }
                                                                    onClick={() =>
                                                                        handleTestIntegration(
                                                                            int.id,
                                                                        )
                                                                    }
                                                                    className={`h-8 flex-1 gap-1.5 rounded-lg border border-border/50 text-[10px] font-black tracking-widest uppercase transition-all ${testingId === int.id ? 'bg-primary/10 text-primary' : 'bg-muted hover:text-emerald-400'}`}
                                                                >
                                                                    {testingId ===
                                                                    int.id ? (
                                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                                    ) : (
                                                                        <Play className="h-3 w-3" />
                                                                    )}
                                                                    {testingId ===
                                                                    int.id
                                                                        ? 'Verifying...'
                                                                        : 'Test Connection'}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        handleEditIntegration(
                                                                            int,
                                                                        )
                                                                    }
                                                                    className="h-8 w-8 rounded-lg border border-border/50 text-blue-400 hover:bg-blue-400/10"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        handleDeleteIntegration(
                                                                            int.id,
                                                                        )
                                                                    }
                                                                    className="h-8 w-8 rounded-lg border border-border/50 text-red-500 hover:bg-red-500/10"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="rounded-3xl border border-dashed border-border bg-card py-24 text-center">
                                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                                <Settings2 className="h-8 w-8 text-muted-foreground opacity-20" />
                                            </div>
                                            <h3 className="text-lg font-black text-foreground">
                                                No active connections
                                            </h3>
                                            <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
                                                Head over to the Marketplace to
                                                connect your first service.
                                            </p>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>

                            <DialogContent className="border-border bg-background text-foreground">
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingIntegration
                                            ? 'Edit Connection'
                                            : 'Connect New Service'}
                                    </DialogTitle>
                                    <DialogDescription className="text-muted-foreground">
                                        Configure your integration settings
                                        below.
                                    </DialogDescription>
                                </DialogHeader>
                                {selectedType && (
                                    <form
                                        onSubmit={handleAddIntegration}
                                        className="space-y-4 py-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>Integration Name</Label>
                                            <Input
                                                value={intForm.data.name}
                                                onChange={(e) =>
                                                    intForm.setData(
                                                        'name',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder={`My ${selectedType.name} Alert`}
                                                className="border-border bg-muted"
                                            />
                                        </div>

                                        {selectedType.fields.map(
                                            (field: any) => (
                                                <div
                                                    key={field.name}
                                                    className="space-y-2"
                                                >
                                                    <Label>{field.label}</Label>
                                                    <Input
                                                        type={field.type}
                                                        value={
                                                            intForm.data.data[
                                                                field.name
                                                            ] || ''
                                                        }
                                                        onChange={(e) =>
                                                            intForm.setData(
                                                                'data',
                                                                {
                                                                    ...intForm
                                                                        .data
                                                                        .data,
                                                                    [field.name]:
                                                                        e.target
                                                                            .value,
                                                                },
                                                            )
                                                        }
                                                        placeholder={
                                                            field.placeholder
                                                        }
                                                        className="border-border bg-muted"
                                                    />
                                                </div>
                                            ),
                                        )}

                                        <div className="flex gap-3 pt-4">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => {
                                                    setIsAddIntegrationOpen(
                                                        false,
                                                    );
                                                    setEditingIntegration(null);
                                                    setSelectedType(null);
                                                }}
                                                className="flex-1"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                disabled={intForm.processing}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                            >
                                                {intForm.processing ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : editingIntegration ? (
                                                    'Save Changes'
                                                ) : (
                                                    'Create Connection'
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                )}
                            </DialogContent>
                        </Dialog>
                    </TabsContent>

                    {/* Alert Rules */}
                    <TabsContent value="alerts" className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-foreground">
                                Smart Alert Rules
                            </h2>
                            <Dialog
                                open={isAddRuleOpen}
                                onOpenChange={(open) => {
                                    setIsAddRuleOpen(open);

                                    if (!open) {
                                        setEditingRule(null);
                                        ruleForm.reset();
                                    }
                                }}
                            >
                                <DialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        className="gap-2 rounded-xl bg-white/10 font-bold text-foreground hover:bg-white/20"
                                    >
                                        <Plus className="h-4 w-4" /> Create Rule
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="border-border bg-background text-foreground">
                                    <DialogHeader>
                                        <DialogTitle>
                                            {editingRule
                                                ? 'Edit Alert Rule'
                                                : 'New Alert Rule'}
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground">
                                            Define what should trigger an alert.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form
                                        onSubmit={handleAddRule}
                                        className="space-y-4 py-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>Rule Name</Label>
                                            <Input
                                                value={ruleForm.data.name}
                                                onChange={(e) =>
                                                    ruleForm.setData(
                                                        'name',
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="Critical Issues"
                                                className="border-border bg-muted"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Trigger Event</Label>
                                            <Select
                                                disabled={!!editingRule}
                                                value={ruleForm.data.event_type}
                                                onValueChange={(v) =>
                                                    ruleForm.setData(
                                                        'event_type',
                                                        v,
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="border-input bg-muted">
                                                    <SelectValue placeholder="When should we alert?" />
                                                </SelectTrigger>
                                                <SelectContent className="border-border bg-popover text-popover-foreground">
                                                    <SelectItem value="new_exception">
                                                        New Exception Detected
                                                    </SelectItem>
                                                    <SelectItem value="success_rate_drop">
                                                        Success Rate Drops
                                                    </SelectItem>
                                                    <SelectItem value="high_latency">
                                                        Average Latency Rises
                                                    </SelectItem>
                                                    <SelectItem value="error_spike">
                                                        Error Spike Detected
                                                    </SelectItem>
                                                    <SelectItem value="uptime_down">
                                                        Site is DOWN (Uptime)
                                                    </SelectItem>
                                                    <SelectItem value="heartbeat_failed">
                                                        Heartbeat Missed (Jobs)
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-4 border-t border-border pt-4">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Zap className="h-4 w-4 text-blue-500" />
                                                <h4 className="text-xs font-black tracking-widest uppercase">
                                                    Throttling
                                                </h4>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black tracking-wider uppercase opacity-60">
                                                        Occurrence Threshold
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            ruleForm.data
                                                                .settings
                                                                .occurrence_threshold ||
                                                            1
                                                        }
                                                        onChange={(e) =>
                                                            ruleForm.setData(
                                                                'settings',
                                                                {
                                                                    ...ruleForm
                                                                        .data
                                                                        .settings,
                                                                    occurrence_threshold:
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                        className="h-9 border-border bg-muted"
                                                    />
                                                    <p className="text-[9px] text-muted-foreground">
                                                        Alert only after X
                                                        occurrences.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black tracking-wider uppercase opacity-60">
                                                        Time Window (Mins)
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            ruleForm.data
                                                                .settings
                                                                .time_window ||
                                                            10
                                                        }
                                                        onChange={(e) =>
                                                            ruleForm.setData(
                                                                'settings',
                                                                {
                                                                    ...ruleForm
                                                                        .data
                                                                        .settings,
                                                                    time_window:
                                                                        parseInt(
                                                                            e
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                        className="h-9 border-border bg-muted"
                                                    />
                                                    <p className="text-[9px] text-muted-foreground">
                                                        Within this time period.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black tracking-wider uppercase opacity-60">
                                                    Throttle Period (Seconds)
                                                </Label>
                                                <Select
                                                    value={String(
                                                        ruleForm.data.settings
                                                            .throttle_period ||
                                                            3600,
                                                    )}
                                                    onValueChange={(v) =>
                                                        ruleForm.setData(
                                                            'settings',
                                                            {
                                                                ...ruleForm.data
                                                                    .settings,
                                                                throttle_period:
                                                                    parseInt(v),
                                                            },
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="h-9 border-border bg-muted">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="border-border bg-popover">
                                                        <SelectItem value="0">
                                                            No Throttling
                                                        </SelectItem>
                                                        <SelectItem value="60">
                                                            1 Minute
                                                        </SelectItem>
                                                        <SelectItem value="300">
                                                            5 Minutes
                                                        </SelectItem>
                                                        <SelectItem value="600">
                                                            10 Minutes
                                                        </SelectItem>
                                                        <SelectItem value="1800">
                                                            30 Minutes
                                                        </SelectItem>
                                                        <SelectItem value="3600">
                                                            1 Hour (Recommended)
                                                        </SelectItem>
                                                        <SelectItem value="86400">
                                                            24 Hours
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[9px] text-muted-foreground">
                                                    Don't send same alert more
                                                    than once in this period.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <Label>Send to Channels</Label>
                                            <div className="grid gap-2">
                                                {integrations.map(
                                                    (int: any) => (
                                                        <div
                                                            key={int.id}
                                                            className="flex items-center space-x-2 rounded-lg bg-muted p-2"
                                                        >
                                                            <Checkbox
                                                                id={`rule-int-${int.id}`}
                                                                checked={ruleForm.data.integration_ids.includes(
                                                                    int.id,
                                                                )}
                                                                onCheckedChange={() => {
                                                                    const ids =
                                                                        [
                                                                            ...ruleForm
                                                                                .data
                                                                                .integration_ids,
                                                                        ];
                                                                    const idx =
                                                                        ids.indexOf(
                                                                            int.id,
                                                                        );

                                                                    if (
                                                                        idx > -1
                                                                    ) {
                                                                        ids.splice(
                                                                            idx,
                                                                            1,
                                                                        );
                                                                    } else {
                                                                        ids.push(
                                                                            int.id,
                                                                        );
                                                                    }

                                                                    ruleForm.setData(
                                                                        'integration_ids',
                                                                        ids,
                                                                    );
                                                                }}
                                                            />
                                                            <label
                                                                htmlFor={`rule-int-${int.id}`}
                                                                className="flex flex-1 cursor-pointer items-center justify-between text-xs"
                                                            >
                                                                <span>
                                                                    {int.name}
                                                                </span>
                                                                {int.status ===
                                                                    'failing' && (
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="h-4 border-red-500/20 bg-red-500/10 py-0 text-[8px] text-red-500"
                                                                    >
                                                                        Offline
                                                                    </Badge>
                                                                )}
                                                            </label>
                                                        </div>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            disabled={ruleForm.processing}
                                            className="mt-4 h-10 w-full bg-primary text-[10px] font-black tracking-widest text-primary-foreground uppercase"
                                        >
                                            {ruleForm.processing ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : editingRule ? (
                                                'Save Changes'
                                            ) : (
                                                'Create Rule'
                                            )}
                                        </Button>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {(alert_rules?.length || 0) > 0 ? (
                                alert_rules.map((rule: any) => (
                                    <Card
                                        key={rule.id}
                                        className="group overflow-hidden border-border bg-card"
                                    >
                                        <CardContent className="p-5">
                                            <div className="mb-4 flex items-start justify-between">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
                                                    <Bell className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <Badge
                                                        className={
                                                            rule.is_enabled
                                                                ? 'border-none bg-emerald-500/10 text-emerald-500'
                                                                : 'border-none bg-muted text-muted-foreground'
                                                        }
                                                    >
                                                        {rule.is_enabled
                                                            ? 'Active'
                                                            : 'Paused'}
                                                    </Badge>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 rounded-md text-blue-400 hover:bg-blue-400/10"
                                                        onClick={() =>
                                                            handleEditRule(rule)
                                                        }
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 rounded-md text-red-500 hover:bg-red-500/10"
                                                        onClick={() =>
                                                            handleDeleteRule(
                                                                rule.id,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-black text-foreground">
                                                {rule.name}
                                            </h3>
                                            <p className="mb-4 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                                                {rule.event_type.replace(
                                                    /_/g,
                                                    ' ',
                                                )}
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {rule.integrations.map(
                                                    (int: any) => (
                                                        <Badge
                                                            key={int.id}
                                                            variant="outline"
                                                            className="border-border bg-muted text-[9px] text-muted-foreground"
                                                        >
                                                            {int.name}
                                                        </Badge>
                                                    ),
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            ) : (
                                <div className="col-span-full rounded-3xl border border-dashed border-border bg-card py-24 text-center">
                                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                                        <Bell className="h-8 w-8 text-muted-foreground opacity-20" />
                                    </div>
                                    <h3 className="text-lg font-black text-foreground">
                                        No alert rules defined
                                    </h3>
                                    <p className="mx-auto mt-2 max-w-xs text-xs text-muted-foreground">
                                        Create your first rule to start
                                        receiving notifications when something
                                        goes wrong.
                                    </p>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* API Keys */}
                    <TabsContent value="api">
                        <Card className="border-border bg-card shadow-2xl">
                            <CardHeader>
                                <CardTitle className="text-foreground">
                                    API Configuration
                                </CardTitle>
                                <CardDescription>
                                    Use these credentials to connect your
                                    application to Laraowl.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label>Project Token</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            readOnly
                                            value={project.api_token}
                                            className="border-border bg-muted font-mono text-xs"
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 rounded-xl bg-muted hover:bg-white/10"
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    project.api_token,
                                                );
                                                toast.success('Token copied!');
                                            }}
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        Keep this token secret. Do not expose it
                                        in client-side code.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Cloudflare Settings */}
                    <TabsContent value="cloudflare">
                        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                            <Card className="overflow-hidden shadow-2xl lg:col-span-7">
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-lg">
                                            <ShieldAlert className="h-7 w-7 text-primary" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-black tracking-tight text-foreground">
                                                Cloudflare Integration
                                            </CardTitle>
                                            <CardDescription className="text-xs">
                                                Connect your zone to enable edge
                                                security metrics and rule
                                                management.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <form
                                        onSubmit={handleUpdateCloudflare}
                                        className="space-y-8"
                                    >
                                        <div className="space-y-6">
                                            <div className="space-y-3">
                                                <Label
                                                    htmlFor="api_token"
                                                    className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                                                >
                                                    API Token
                                                </Label>
                                                <Input
                                                    id="api_token"
                                                    type="password"
                                                    placeholder="Enter your Cloudflare API Token"
                                                    className={`h-11 border-border bg-muted/50 font-mono text-xs focus:ring-primary/20 ${cloudflareForm.errors.api_token ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
                                                    value={
                                                        cloudflareForm.data
                                                            .api_token
                                                    }
                                                    onChange={(e) =>
                                                        cloudflareForm.setData(
                                                            'api_token',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                {cloudflareForm.errors
                                                    .api_token && (
                                                    <p className="animate-in text-[10px] font-bold text-red-500 fade-in slide-in-from-top-1">
                                                        {
                                                            cloudflareForm
                                                                .errors
                                                                .api_token
                                                        }
                                                    </p>
                                                )}

                                                <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                                                    <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-foreground uppercase">
                                                        <Lock className="size-3 text-primary" />
                                                        Required Token
                                                        Permissions
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {[
                                                            {
                                                                p: 'Zone.Zone',
                                                                l: 'Read',
                                                                desc: 'Basic zone info',
                                                            },
                                                            {
                                                                p: 'Zone.Settings',
                                                                l: 'Edit',
                                                                desc: 'Attack mode & WAF',
                                                            },
                                                            {
                                                                p: 'Zone.Analytics',
                                                                l: 'Read',
                                                                desc: 'Traffic metrics',
                                                            },
                                                            {
                                                                p: 'Zone.Firewall Services',
                                                                l: 'Edit',
                                                                desc: 'IP & Firewall rules',
                                                            },
                                                        ].map((perm, i) => (
                                                            <div
                                                                key={i}
                                                                className="flex flex-col gap-0.5 rounded-lg border border-border/50 bg-background/50 p-2"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <code className="text-[9px] font-bold text-primary">
                                                                        {perm.p}
                                                                    </code>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="h-3.5 bg-primary/5 px-1 text-[8px] font-black"
                                                                    >
                                                                        {perm.l}
                                                                    </Badge>
                                                                </div>
                                                                <span className="text-[8px] font-medium text-muted-foreground">
                                                                    {perm.desc}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <Label
                                                    htmlFor="zone_id"
                                                    className="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
                                                >
                                                    Zone ID
                                                </Label>
                                                <Input
                                                    id="zone_id"
                                                    placeholder="Enter your Cloudflare Zone ID"
                                                    className={`h-11 border-border bg-muted/50 font-mono text-xs focus:ring-primary/20 ${cloudflareForm.errors.zone_id ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
                                                    value={
                                                        cloudflareForm.data
                                                            .zone_id
                                                    }
                                                    onChange={(e) =>
                                                        cloudflareForm.setData(
                                                            'zone_id',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                {cloudflareForm.errors
                                                    .zone_id && (
                                                    <p className="animate-in text-[10px] font-bold text-red-500 fade-in slide-in-from-top-1">
                                                        {
                                                            cloudflareForm
                                                                .errors.zone_id
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end border-t border-border/50 pt-6">
                                            <Button
                                                disabled={
                                                    cloudflareForm.processing
                                                }
                                                className="h-11 rounded-xl px-8 text-xs font-black tracking-widest uppercase shadow-xl shadow-primary/10 transition-all hover:shadow-primary/20"
                                            >
                                                {cloudflareForm.processing ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Zap className="mr-2 size-3.5 fill-current" />
                                                )}
                                                Save Integration
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>

                            <Card className="lg:col-span-5">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg border border-primary/20 bg-primary/10 p-1.5 text-primary">
                                            <Info className="h-4 w-4" />
                                        </div>
                                        <h4 className="text-xs font-black tracking-wider text-foreground uppercase">
                                            Setup Instructions
                                        </h4>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-6">
                                    <div className="space-y-6">
                                        <div className="space-y-4">
                                            {[
                                                {
                                                    step: 1,
                                                    text: (
                                                        <>
                                                            Go to{' '}
                                                            <a
                                                                href="https://dash.cloudflare.com/profile/api-tokens"
                                                                target="_blank"
                                                                className="font-bold text-primary hover:underline"
                                                            >
                                                                Cloudflare API
                                                                Tokens
                                                            </a>
                                                        </>
                                                    ),
                                                },
                                                {
                                                    step: 2,
                                                    text: 'Create a token using the "Edit Zone DNS" template or a custom one.',
                                                },
                                                {
                                                    step: 3,
                                                    text: 'Ensure you add all 4 permissions listed on the left.',
                                                },
                                                {
                                                    step: 4,
                                                    text: 'Select "All Zones" or your specific domain in Zone Resources.',
                                                },
                                            ].map((item, i) => (
                                                <div
                                                    key={i}
                                                    className="flex gap-4"
                                                >
                                                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-black text-primary">
                                                        {item.step}
                                                    </div>
                                                    <p className="pt-0.5 text-[11px] leading-relaxed font-medium text-muted-foreground">
                                                        {item.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                                            <div className="mb-2 flex items-center gap-2">
                                                <AlertCircle className="size-3 text-primary" />
                                                <span className="text-[9px] font-black tracking-widest text-primary uppercase">
                                                    Important Note
                                                </span>
                                            </div>
                                            <p className="text-[10px] leading-relaxed text-muted-foreground">
                                                Laraowl requires{' '}
                                                <strong>Global</strong> or{' '}
                                                <strong>Specific Zone</strong>{' '}
                                                access. If the connection fails,
                                                verify that your token hasn't
                                                expired and the Zone ID matches
                                                exactly.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}

function ThresholdForm({
    type,
    teamSlug,
    projectSlug,
    onSuccess,
}: {
    type: string;
    teamSlug: string;
    projectSlug: string;
    onSuccess?: () => void;
}) {
    const form = useForm({
        type: type,
        key: '',
        value: 500,
    });

    const getLabel = () => {
        switch (type) {
            case 'route':
                return 'Route Path';
            case 'job':
                return 'Job Class';
            case 'command':
                return 'Command Name';
            case 'scheduled-task':
                return 'Task Command';
            case 'query':
                return 'SQL Query Fragment';
            default:
                return 'Key';
        }
    };

    const getPlaceholder = () => {
        switch (type) {
            case 'route':
                return '/api/v1/users';
            case 'job':
                return 'App\\Jobs\\ProcessData';
            case 'command':
                return 'mail:send';
            case 'scheduled-task':
                return 'telescope:prune';
            case 'query':
                return 'SELECT * FROM users...';
            default:
                return 'Search key...';
        }
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/${teamSlug}/${projectSlug}/thresholds`, {
            onSuccess: () => {
                form.reset();
                toast.success('Threshold added');

                if (onSuccess) {
                    onSuccess();
                }
            },
        });
    };

    return (
        <form onSubmit={submit} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>{getLabel()}</Label>
                <Input
                    value={form.data.key}
                    onChange={(e) => form.setData('key', e.target.value)}
                    placeholder={getPlaceholder()}
                    className="border-border bg-muted"
                    required
                />
            </div>
            <div className="space-y-2">
                <Label>Threshold (ms)</Label>
                <Input
                    type="number"
                    value={form.data.value}
                    onChange={(e) =>
                        form.setData('value', parseInt(e.target.value))
                    }
                    className="border-border bg-muted"
                    required
                />
            </div>
            <Button
                disabled={form.processing}
                className="h-10 w-full bg-primary text-[10px] font-black tracking-widest text-primary-foreground uppercase"
            >
                {form.processing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    'Create Threshold'
                )}
            </Button>
        </form>
    );
}

ProjectSettings.layout = (page: any) => (
    <AppLayout
        children={page}
        breadcrumbs={[{ title: 'Project Settings', href: '#' }]}
    />
);
