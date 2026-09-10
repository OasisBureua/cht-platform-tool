import type { LucideIcon } from 'lucide-react';
import {
  Mic2,
  Radio,
  CalendarClock,
  MonitorPlay,
  ClipboardList,
  Banknote,
  MessagesSquare,
} from 'lucide-react';
import type { NavIconTone } from './navIconTones';
import { isCompanionEnabled } from '../../config/app-urls';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Resting colour of the ICON. Stable per destination — see navIconTones. */
  iconTone: NavIconTone;
  end?: boolean;
  /** Optional tooltip / accessible name when label is shortened. */
  title?: string;
};

/** Sidebar Conversations → catalog home (featured strips + biomarker rows). */
export const APP_CATALOG_CONVERSATIONS_HUB = '/app/catalog';

/** Full clips library (search, filters, grid): “See all in library”. Playlists: `?view=playlists`. */
export const APP_CATALOG_CLIPS_GRID = '/app/catalog?view=clips';

/** Breadcrumb / back from playlist detail → playlists browse UI. */
export const APP_CATALOG_PLAYLISTS_BROWSE = '/app/catalog?view=playlists';

/**
 * Primary app destinations: desktop sidebar + mobile slide-reveal drawer
 * (Search lives in header).
 *
 * `iconTone` runs coral → purple → cyan → pink → blue → green (+ amber for Companion).
 * Destinations that also exist in the admin shell keep the same hue there.
 */
const APP_NAV_ITEMS_CORE: AppNavItem[] = [
  { to: '/app/live', label: 'LIVE', icon: Radio, iconTone: 'text-ink-coral', end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, iconTone: 'text-ink-purple', end: false },
  { to: APP_CATALOG_CONVERSATIONS_HUB, label: 'Conversations', icon: MonitorPlay, iconTone: 'text-ink-cyan', end: false },
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, iconTone: 'text-ink-pink', end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-anchor', end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, iconTone: 'text-ink-green', end: false },
];

const COMPANION_NAV_ITEM: AppNavItem = {
  to: '/app/chatbot',
  label: 'Companion',
  title: 'Companion (chatbot)',
  icon: MessagesSquare,
  iconTone: 'text-amber',
  end: false,
};

/** @deprecated Prefer getAppNavItems() so Companion stays env-gated. */
export const APP_NAV_ITEMS: AppNavItem[] = APP_NAV_ITEMS_CORE;

/** Sidebar + mobile drawer destinations (Companion only on devapp / local). */
export function getAppNavItems(): AppNavItem[] {
  if (!isCompanionEnabled()) return APP_NAV_ITEMS_CORE;
  // Seat Companion before Earnings so amber is not adjacent to ink-green in dark mode.
  const earningsIdx = APP_NAV_ITEMS_CORE.findIndex((i) => i.to === '/app/earnings');
  if (earningsIdx < 0) return [...APP_NAV_ITEMS_CORE, COMPANION_NAV_ITEM];
  return [
    ...APP_NAV_ITEMS_CORE.slice(0, earningsIdx),
    COMPANION_NAV_ITEM,
    ...APP_NAV_ITEMS_CORE.slice(earningsIdx),
  ];
}
