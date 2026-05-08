import type { LucideIcon } from 'lucide-react';
import {
  Mic2,
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

/** Logo + sidebar Conversations: catalogue home (clips); use ?view=playlists only after Playlists is chosen. */
export const APP_CATALOG_CONVERSATIONS_HUB = '/app/catalog';

/** Breadcrumb / back from playlist detail → playlists browse UI. */
export const APP_CATALOG_PLAYLISTS_BROWSE = '/app/catalog?view=playlists';

/** Primary app destinations — desktop sidebar + mobile slide-reveal drawer (Search lives in header) */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, end: false },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, end: false },
  { to: APP_CATALOG_CONVERSATIONS_HUB, label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'Chatbot', icon: Bot, end: false },
];
