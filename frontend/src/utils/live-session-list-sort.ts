import {
  isSessionExpired,
  isSessionLiveNow,
} from './live-session-timing';

/** Shared sort keys for participant + admin live session lists. */
export type LiveSessionSortKey =
  | 'date_asc'
  | 'date_desc'
  | 'title_asc'
  | 'topic_asc'
  | 'status';

export const LIVE_SESSION_SORT_DEFAULT: LiveSessionSortKey = 'date_asc';

export const LIVE_SESSION_SORT_OPTIONS: ReadonlyArray<{
  value: LiveSessionSortKey;
  label: string;
}> = [
  { value: 'date_asc', label: 'Date · soonest first' },
  { value: 'date_desc', label: 'Date · latest first' },
  { value: 'title_asc', label: 'Title · A to Z' },
  { value: 'topic_asc', label: 'Program / topic · A to Z' },
  { value: 'status', label: 'Status · live, upcoming, closed' },
];

const SORT_KEY_SET = new Set<string>(LIVE_SESSION_SORT_OPTIONS.map((o) => o.value));

export function parseLiveSessionSortKey(
  raw: string | null | undefined,
): LiveSessionSortKey {
  if (raw && SORT_KEY_SET.has(raw)) return raw as LiveSessionSortKey;
  return LIVE_SESSION_SORT_DEFAULT;
}

export function liveSessionSortLabel(key: LiveSessionSortKey): string {
  return LIVE_SESSION_SORT_OPTIONS.find((o) => o.value === key)?.label ?? key;
}

/** Lifecycle for “status” sort and pinning live-now on date_asc. */
export type LiveSessionLifecycle = 'live' | 'upcoming' | 'closed';

export function liveSessionLifecycle(
  startTime?: string | Date | null,
  durationMinutes?: number | null,
  now: Date = new Date(),
): LiveSessionLifecycle {
  if (isSessionLiveNow(startTime, durationMinutes, now)) return 'live';
  if (isSessionExpired(startTime, durationMinutes, now)) return 'closed';
  return 'upcoming';
}

function lifecycleRank(life: LiveSessionLifecycle): number {
  if (life === 'live') return 0;
  if (life === 'upcoming') return 1;
  return 2;
}

function startMs(startTime?: string | Date | null): number {
  if (!startTime) return Number.POSITIVE_INFINITY;
  const d = startTime instanceof Date ? startTime : new Date(startTime);
  const t = d.getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

export type LiveSessionSortable = {
  id: string;
  title: string;
  /** Participant lists use startTime; admin uses startDate. */
  startTime?: string | Date | null;
  startDate?: string | Date | null;
  duration?: number | null;
  /** Sponsor / topic label when present (admin). */
  sponsorName?: string | null;
  /** Publish status when present (admin secondary). */
  status?: string | null;
};

function rowStart(row: LiveSessionSortable): string | Date | null | undefined {
  return row.startTime ?? row.startDate;
}

function topicKey(row: LiveSessionSortable): string {
  const topic = row.sponsorName?.trim();
  return (topic || row.title || '').toLocaleLowerCase();
}

/**
 * Stable sort: primary by `sortKey`, ties broken by title then id.
 * For `date_asc`, live-now sessions stay pinned above other upcoming.
 */
export function sortLiveSessions<T extends LiveSessionSortable>(
  items: readonly T[],
  sortKey: LiveSessionSortKey,
  now: Date = new Date(),
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    let cmp = 0;
    const aStart = rowStart(a);
    const bStart = rowStart(b);
    const aMs = startMs(aStart);
    const bMs = startMs(bStart);
    const aLife = liveSessionLifecycle(aStart, a.duration, now);
    const bLife = liveSessionLifecycle(bStart, b.duration, now);

    switch (sortKey) {
      case 'date_asc': {
        // Live now first, then soonest start among the rest.
        if (aLife === 'live' && bLife !== 'live') cmp = -1;
        else if (bLife === 'live' && aLife !== 'live') cmp = 1;
        else cmp = aMs - bMs;
        break;
      }
      case 'date_desc':
        cmp = bMs - aMs;
        // Finite dates before missing.
        if (!Number.isFinite(aMs) && Number.isFinite(bMs)) cmp = 1;
        if (Number.isFinite(aMs) && !Number.isFinite(bMs)) cmp = -1;
        break;
      case 'title_asc':
        cmp = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        break;
      case 'topic_asc':
        cmp = topicKey(a).localeCompare(topicKey(b), undefined, {
          sensitivity: 'base',
        });
        break;
      case 'status':
        cmp = lifecycleRank(aLife) - lifecycleRank(bLife);
        if (cmp === 0) cmp = aMs - bMs;
        break;
      default:
        cmp = aMs - bMs;
    }

    if (cmp !== 0) return cmp;
    const titleCmp = a.title.localeCompare(b.title, undefined, {
      sensitivity: 'base',
    });
    if (titleCmp !== 0) return titleCmp;
    return a.id.localeCompare(b.id);
  });
  return copy;
}

export function readSessionSort(
  storageKey: string,
): LiveSessionSortKey {
  try {
    return parseLiveSessionSortKey(sessionStorage.getItem(storageKey));
  } catch {
    return LIVE_SESSION_SORT_DEFAULT;
  }
}

export function writeSessionSort(
  storageKey: string,
  key: LiveSessionSortKey,
): void {
  try {
    if (key === LIVE_SESSION_SORT_DEFAULT) sessionStorage.removeItem(storageKey);
    else sessionStorage.setItem(storageKey, key);
  } catch {
    /* ignore quota / private mode */
  }
}

export const LIVE_WEBINARS_SORT_STORAGE_KEY = 'cht-live-webinars-sort';
export const OFFICE_HOURS_SORT_STORAGE_KEY = 'cht-office-hours-sort';
export const ADMIN_WEBINARS_SORT_STORAGE_KEY = 'cht-admin-webinars-sort';
export const ADMIN_OFFICE_HOURS_SORT_STORAGE_KEY = 'cht-admin-office-hours-sort';
