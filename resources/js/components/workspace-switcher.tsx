import { router, usePage } from '@inertiajs/react';
import {
    Check,
    ChevronsUpDown,
    Plus,
    Layout,
    Layers,
    Terminal,
    Search,
    Settings2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import CreateProjectModal from '@/components/create-project-modal';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { ALL_PROJECTS_SLUG } from '@/lib/project-scope';

export function WorkspaceSwitcher({
    inHeader = false,
}: {
    inHeader?: boolean;
}) {
    const { props }: any = usePage();
    const isMobile = useIsMobile();
    const currentTeam = props.currentTeam;
    const projects = props.projects ?? [];
    const currentProject = props.currentProject;

    const [search, setSearch] = useState('');

    const filteredTeams = useMemo(() => {
        const teamsList = props.teams ?? [];

        return teamsList.filter((t: any) =>
            t.name.toLowerCase().includes(search.toLowerCase()),
        );
    }, [props.teams, search]);

    const switchProject = (project: any) => {
        const projectTeam =
            (props.teams ?? []).find((t: any) => t.id === project.team_id) ??
            currentTeam;
        const newPrefix = `/${projectTeam.slug}/${project.slug}`;

        const currentUrl = window.location.pathname;
        const oldPrefix =
            currentTeam && currentProject
                ? `/${currentTeam.slug}/${currentProject.slug}`
                : null;

        if (oldPrefix && currentUrl.includes(oldPrefix)) {
            router.visit(currentUrl.replace(oldPrefix, newPrefix));
        } else {
            router.visit(newPrefix + '/dashboard');
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className={
                        inHeader
                            ? 'h-9 max-w-[200px] gap-2 rounded-lg border border-border px-3 text-foreground/70 transition-all hover:bg-muted hover:text-foreground'
                            : 'group w-full justify-start border border-border bg-muted/30 px-2 py-8 transition-all group-data-[collapsible=icon]:py-4 hover:bg-white/[0.05]'
                    }
                >
                    <div
                        className={
                            inHeader
                                ? 'flex aspect-square size-5 shrink-0 items-center justify-center rounded bg-blue-600/20 text-blue-400'
                                : 'mr-3 flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground group-data-[collapsible=icon]:mr-0 group-data-[collapsible=icon]:size-6'
                        }
                    >
                        <Terminal className={inHeader ? 'size-3' : 'size-4'} />
                    </div>
                    <div
                        className={
                            inHeader
                                ? 'flex min-w-0 flex-col items-start leading-tight'
                                : 'grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden'
                        }
                    >
                        <div className="flex w-full items-center gap-1.5">
                            <span
                                title={currentTeam?.name}
                                className={
                                    inHeader
                                        ? 'truncate text-[11px] font-bold tracking-tight text-foreground'
                                        : 'truncate text-sm font-bold tracking-tight text-foreground uppercase'
                                }
                            >
                                {currentTeam?.name ?? 'Select Team'}
                            </span>
                        </div>
                        <div className="mt-0.5 flex w-full items-center gap-1">
                            <Layout className="size-2.5 shrink-0 text-foreground/40" />
                            <span
                                title={currentProject?.name}
                                className="truncate text-[10px] font-medium tracking-tight text-foreground/60"
                            >
                                {currentProject?.name ?? 'No Project'}
                            </span>
                        </div>
                    </div>
                    <ChevronsUpDown
                        className={
                            inHeader
                                ? 'ml-1 size-3 shrink-0 text-foreground/20'
                                : 'ml-auto size-4 shrink-0 text-foreground/20 group-data-[collapsible=icon]:hidden'
                        }
                    />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-72 overflow-hidden rounded-xl border-border bg-card p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                side={inHeader ? 'bottom' : isMobile ? 'bottom' : 'right'}
                align={inHeader ? 'end' : 'start'}
                sideOffset={inHeader ? 8 : 4}
            >
                {/* Search Bar */}
                <div className="flex items-center gap-2 border-b border-border px-3 py-3">
                    <Search className="size-4 text-foreground/20" />
                    <input
                        className="w-full border-none bg-transparent p-0 text-sm text-foreground placeholder:text-foreground/20 focus:ring-0"
                        placeholder="Find application or organization"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="custom-scrollbar max-h-[400px] overflow-y-auto">
                    {/* Organizations/Teams Section */}
                    <div className="p-1">
                        {filteredTeams.map((team: any) => (
                            <div key={team.id} className="mb-4 last:mb-0">
                                <div className="flex items-center justify-between px-3 py-2">
                                    <span
                                        className="truncate text-[11px] font-black tracking-[0.1em] text-foreground/30 uppercase"
                                        title={team.name}
                                    >
                                        {team.name}
                                    </span>
                                    <Settings2
                                        className="size-3.5 shrink-0 cursor-pointer text-foreground/20 transition-colors hover:text-foreground/60"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.visit(
                                                `/settings/teams/${team.slug}`,
                                            );
                                        }}
                                    />
                                </div>

                                <div className="space-y-0.5">
                                    {'all'.includes(search.toLowerCase()) && (
                                        <DropdownMenuItem
                                            key={`${team.id}-${ALL_PROJECTS_SLUG}`}
                                            onSelect={() =>
                                                switchProject({
                                                    id: null,
                                                    team_id: team.id,
                                                    slug: ALL_PROJECTS_SLUG,
                                                    name: 'All',
                                                })
                                            }
                                            className="group mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-foreground shadow-lg">
                                                    <Layers className="size-5" />
                                                </div>
                                                <span
                                                    className={`truncate text-sm font-semibold ${
                                                        currentTeam?.id ===
                                                            team.id &&
                                                        currentProject?.slug ===
                                                            ALL_PROJECTS_SLUG
                                                            ? 'text-foreground'
                                                            : 'text-foreground/60'
                                                    }`}
                                                >
                                                    All
                                                </span>
                                            </div>
                                            {currentTeam?.id === team.id &&
                                                currentProject?.slug ===
                                                    ALL_PROJECTS_SLUG && (
                                                    <Check className="size-4 shrink-0 text-foreground" />
                                                )}
                                        </DropdownMenuItem>
                                    )}
                                    {projects
                                        .filter(
                                            (p: any) => p.team_id === team.id,
                                        )
                                        .filter((p: any) =>
                                            p.name
                                                .toLowerCase()
                                                .includes(search.toLowerCase()),
                                        )
                                        .map((project: any, index: number) => (
                                            <DropdownMenuItem
                                                key={project.id}
                                                onSelect={() =>
                                                    switchProject(project)
                                                }
                                                className="group mx-1 flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                                            >
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div
                                                        className={`size-9 shrink-0 rounded-lg bg-gradient-to-br ${
                                                            [
                                                                'from-indigo-500 to-purple-600',
                                                                'from-blue-500 to-cyan-400',
                                                                'from-emerald-500 to-teal-400',
                                                                'from-orange-500 to-amber-400',
                                                                'from-rose-500 to-pink-400',
                                                            ][index % 5]
                                                        } flex items-center justify-center text-foreground shadow-lg`}
                                                    >
                                                        <Layout className="size-5" />
                                                    </div>
                                                    <span
                                                        title={project.name}
                                                        className={`truncate text-sm font-semibold ${currentProject?.id === project.id ? 'text-foreground' : 'text-foreground/60'}`}
                                                    >
                                                        {project.name}
                                                    </span>
                                                </div>
                                                {currentProject?.id ===
                                                    project.id && (
                                                    <Check className="size-4 shrink-0 text-foreground" />
                                                )}
                                            </DropdownMenuItem>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DropdownMenuSeparator className="m-0 bg-muted" />

                <div className="p-1.5">
                    <CreateProjectModal>
                        <DropdownMenuItem
                            onSelect={(e) => {
                                e.preventDefault();
                            }}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-3 text-foreground/50 transition-colors hover:text-foreground"
                        >
                            <Plus className="size-4" />
                            <span className="text-sm font-semibold">
                                New Application
                            </span>
                        </DropdownMenuItem>
                    </CreateProjectModal>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
