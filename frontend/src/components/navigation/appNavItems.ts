import type { LucideIcon } from 'lucide-react';
import {
  Mic2,
  Radio,
  CalendarClock,
  MonitorPlay,
  ClipboardList,
  Banknote,
} from 'lucide-react';
import type { NavIconTone } from './navIconTones';

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Resting colour of the ICON. Stable per destination — see navIconTones. */
  iconTone: NavIconTone;
  end?: boolean;
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
 * Icons are black by default; LIVE is red and Earnings is green.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/app/live', label: 'LIVE', icon: Radio, iconTone: 'text-red-600', end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, iconTone: 'text-foreground', end: false },
  { to: APP_CATALOG_CONVERSATIONS_HUB, label: 'Conversations', icon: MonitorPlay, iconTone: 'text-foreground', end: false },
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, iconTone: 'text-foreground', end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-foreground', end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, iconTone: 'text-green-600', end: false },
];
