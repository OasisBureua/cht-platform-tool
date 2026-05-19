import type { LucideIcon } from 'lucide-react';
import {
  Radio,
  CalendarClock,
  ClipboardList,
  ClipboardCheck,
  DollarSign,
  Users,
} from 'lucide-react';

export type AdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

/** Desktop admin sidebar + mobile slide drawer */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { to: '/admin/programs', label: 'LIVE', icon: Radio, end: false },
  { to: '/admin/office-hours', label: 'Office Hours', icon: CalendarClock, end: false },
  { to: '/admin/webinar-approvals', label: 'Approvals', icon: ClipboardCheck, end: false },
  { to: '/admin/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/admin/payments', label: 'Earnings', icon: DollarSign, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
];
