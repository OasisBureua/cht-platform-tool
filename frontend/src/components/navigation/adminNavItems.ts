import type { LucideIcon } from 'lucide-react';
import {
  Radio,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  DollarSign,
  Users,
  FileBarChart,
  Stethoscope,
  Newspaper,
  LayoutDashboard,
  Wrench,
} from 'lucide-react';
import type { NavIconTone } from './navIconTones';

export type AdminNavLeaf = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Resting colour of the ICON. Stable per destination — see navIconTones. */
  iconTone: NavIconTone;
  end?: boolean;
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  iconTone: NavIconTone;
  children: AdminNavLeaf[];
};

export type AdminNavEntry = AdminNavLeaf | AdminNavGroup;

export function isAdminNavGroup(entry: AdminNavEntry): entry is AdminNavGroup {
  return 'children' in entry && Array.isArray(entry.children);
}

/** @deprecated Prefer AdminNavLeaf — kept for callers that still import AdminNavItem. */
export type AdminNavItem = AdminNavLeaf;

/**
 * Desktop admin sidebar.
 *
 * Icons are black by default; LIVE is red and Earnings is green
 * (same convention as the member `/app` rail).
 * Content / Reporting / Campaigns are nested under Tools (Apple-style flyout).
 */
export const ADMIN_NAV_ITEMS: AdminNavEntry[] = [
  { to: '/admin/programs', label: 'LIVE', icon: Radio, iconTone: 'text-red-600', end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: CalendarClock, iconTone: 'text-foreground', end: false },
  { to: '/admin/webinar-approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: 'text-foreground', end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-foreground', end: false },
  { to: '/admin/payments', label: 'Earnings', icon: DollarSign, iconTone: 'text-green-600', end: false },
  { to: '/admin/kol-network', label: 'KOL Network', icon: Stethoscope, iconTone: 'text-foreground', end: false },
  { to: '/admin/users', label: 'Users', icon: Users, iconTone: 'text-foreground', end: false },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    iconTone: 'text-foreground',
    children: [
      { to: '/admin/content', label: 'Content', icon: Newspaper, iconTone: 'text-foreground', end: false },
      { to: '/admin/content-hub', label: 'Reporting', icon: FileBarChart, iconTone: 'text-foreground', end: false },
      {
        to: '/admin/campaigns-dashboard',
        label: 'Campaigns Dashboard',
        icon: LayoutDashboard,
        iconTone: 'text-foreground',
        end: false,
      },
    ],
  },
];

export function adminNavGroupIsActive(group: AdminNavGroup, pathname: string): boolean {
  return group.children.some(
    (child) => pathname === child.to || pathname.startsWith(`${child.to}/`),
  );
}
