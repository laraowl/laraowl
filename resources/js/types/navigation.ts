import type { InertiaLinkProps } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';

export type BreadcrumbItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
};

export type NavItem = {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    items?: NavItem[];
    /** Shown but not clickable — e.g. a per-application screen while "All" is selected. */
    disabled?: boolean;
    /** Tooltip text explaining why, shown when `disabled` is true. */
    disabledReason?: string;
};
