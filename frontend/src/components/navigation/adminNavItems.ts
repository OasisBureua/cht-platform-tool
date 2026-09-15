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
} from 'lucide-react';
import type { NavIconTone } from './navIconTones';

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Resting colour of the ICON. Stable per destination — see navIconTones. */
  iconTone: NavIconTone;
  end?: boolean;
};

/**
 * Desktop admin sidebar + mobile slide drawer.
 *
 * Icons are black by default; LIVE is red and Earnings is green
 * (same convention as the member `/app` rail).
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin/programs', label: 'LIVE', icon: Radio, iconTone: 'text-red-600', end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: CalendarClock, iconTone: 'text-foreground', end: false },
  { to: '/admin/webinar-approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: 'text-foreground', end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-foreground', end: false },
  { to: '/admin/payments', label: 'Earnings', icon: DollarSign, iconTone: 'text-green-600', end: false },
  { to: '/admin/kol-network', label: 'KOL Network', icon: Stethoscope, iconTone: 'text-foreground', end: false },
  { to: '/admin/users', label: 'Users', icon: Users, iconTone: 'text-foreground', end: false },
  { to: '/admin/content', label: 'Content', icon: Newspaper, iconTone: 'text-foreground', end: false },
  { to: '/admin/content-hub', label: 'Reporting', icon: FileBarChart, iconTone: 'text-foreground', end: false },
  { to: '/admin/campaigns-dashboard', label: 'Campaigns Dashboard', icon: LayoutDashboard, iconTone: 'text-foreground', end: false },
];
