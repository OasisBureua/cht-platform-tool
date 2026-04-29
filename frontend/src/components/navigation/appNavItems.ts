import type { LucideIcon } from 'lucide-react';
import {
  Search,
  Radio,
  CalendarClock,
  MonitorPlay,
  ClipboardList,
  Banknote,
  Bot,
} from 'lucide-react';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

/** Primary app destinations — sidebar, bottom nav, and mobile slide-reveal drawer */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/app/search', label: 'Search', icon: Search, end: false },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, end: false },
  { to: '/app/catalog', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'Chatbot', icon: Bot, end: false },
];
