import { Link } from '@inertiajs/react';
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { NavItem } from '@/types';

export function NavMain({
    items = [],
    label,
}: {
    items: NavItem[];
    label?: string;
}) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <SidebarGroup className="px-2 py-0">
            {label && (
                <SidebarGroupLabel className="hidden text-[9px] font-bold tracking-widest text-foreground/20 uppercase group-data-[collapsible=icon]:hidden">
                    {label}
                </SidebarGroupLabel>
            )}
            <SidebarMenu>
                {items.map((item) =>
                    item.disabled ? (
                        <SidebarMenuItem key={item.title}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <SidebarMenuButton
                                        tabIndex={-1}
                                        // Not `aria-disabled`: the shared
                                        // sidebarMenuButtonVariants styles
                                        // set `pointer-events-none` on it,
                                        // which would also block the hover
                                        // that triggers this tooltip. The
                                        // button already has no href/onClick,
                                        // so it's inert either way.
                                        className="cursor-not-allowed text-foreground/25 hover:bg-transparent hover:text-foreground/25"
                                    >
                                        <div className="flex items-center gap-3">
                                            {item.icon && (
                                                <item.icon className="size-4 text-foreground/20" />
                                            )}
                                            <span className="tracking-tight">
                                                {item.title}
                                            </span>
                                        </div>
                                    </SidebarMenuButton>
                                </TooltipTrigger>
                                <TooltipContent side="right" align="center">
                                    {item.disabledReason || item.title}
                                </TooltipContent>
                            </Tooltip>
                        </SidebarMenuItem>
                    ) : (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                isActive={isCurrentUrl(item.href)}
                                tooltip={{ children: item.title }}
                                className={`group/menu-item transition-all duration-200 ${
                                    isCurrentUrl(item.href)
                                        ? 'bg-white/10 font-bold text-foreground shadow-[0_0_15px_rgba(255,255,255,0.05)]'
                                        : 'text-foreground/50 hover:bg-muted hover:text-foreground'
                                } `}
                            >
                                <Link
                                    href={item.href}
                                    prefetch
                                    className="flex items-center gap-3"
                                >
                                    {item.icon && (
                                        <item.icon
                                            className={`size-4 transition-transform duration-200 group-hover/menu-item:scale-110 ${isCurrentUrl(item.href) ? 'text-foreground' : 'text-foreground/40'}`}
                                        />
                                    )}
                                    <span className="tracking-tight">
                                        {item.title}
                                    </span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ),
                )}
            </SidebarMenu>
        </SidebarGroup>
    );
}
