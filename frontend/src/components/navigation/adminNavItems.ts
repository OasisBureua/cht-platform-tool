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
 * The four destinations that also exist in the member shell (LIVE, Office
 * Hours, Surveys, Earnings) carry the same hue there, so a rail is read the
 * same way in both. Ten items over seven tones means three repeats; they are
 * placed five to seven rows apart and never adjacent.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin/programs', label: 'LIVE', icon: Radio, iconTone: 'text-ink-coral', end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: CalendarClock, iconTone: 'text-ink-purple', end: false },
  { to: '/admin/webinar-approvals', label: 'Approvals', icon: ClipboardCheck, iconTone: 'text-ink-cyan', end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-anchor', end: false },
  { to: '/admin/payments', label: 'Earnings', icon: DollarSign, iconTone: 'text-ink-green', end: false },
  { to: '/admin/kol-network', label: 'KOL Network', icon: Stethoscope, iconTone: 'text-ink-pink', end: false },
  { to: '/admin/users', label: 'Users', icon: Users, iconTone: 'text-amber', end: false },
  { to: '/admin/content', label: 'Content', icon: Newspaper, iconTone: 'text-ink-cyan', end: false },
  { to: '/admin/content-hub', label: 'Reporting', icon: FileBarChart, iconTone: 'text-ink-purple', end: false },
  { to: '/admin/campaigns-dashboard', label: 'Campaigns Dashboard', icon: LayoutDashboard, iconTone: 'text-anchor', end: false },
];
