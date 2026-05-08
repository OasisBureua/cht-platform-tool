import type { LucideIcon } from 'lucide-react';
import {
  Radio,
  MonitorPlay,
  ClipboardList,
  Banknote,
  Mic2,
  Bot,
} from 'lucide-react';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

/** Primary app destinations — desktop sidebar + mobile slide-reveal drawer (Search lives in header) */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, end: false },
  { to: '/app/live', label: 'LIVE', icon: Radio, end: false },
  { to: '/app/catalog', label: 'Conversations', icon: MonitorPlay, end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, end: false },
  { to: '/app/chatbot', label: 'Chatbot', icon: Bot, end: false },
];
