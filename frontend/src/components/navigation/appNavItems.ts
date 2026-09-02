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
 * `iconTone` runs coral → purple → cyan → pink → blue → green down the rail.
 * Destinations that also exist in the admin shell keep the same hue there.
 */
export const APP_NAV_ITEMS: AppNavItem[] = [
  { to: '/app/live', label: 'LIVE', icon: Radio, iconTone: 'text-ink-coral', end: false },
  { to: '/app/chm-office-hours', label: 'Office Hrs', icon: CalendarClock, iconTone: 'text-ink-purple', end: false },
  { to: APP_CATALOG_CONVERSATIONS_HUB, label: 'Conversations', icon: MonitorPlay, iconTone: 'text-ink-cyan', end: false },
  { to: '/app/podcasts', label: 'Podcasts', icon: Mic2, iconTone: 'text-ink-pink', end: false },
  { to: '/app/surveys', label: 'Surveys', icon: ClipboardList, iconTone: 'text-anchor', end: false },
  { to: '/app/earnings', label: 'Earnings', icon: Banknote, iconTone: 'text-ink-green', end: false },
];
