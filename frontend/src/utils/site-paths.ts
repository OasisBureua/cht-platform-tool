/**
 * Canonical public + member URL bases.
 * Prefer these helpers over hardcoding so marketing and /app stay aligned.
 */

/** Public marketing homepage (also served at legacy `/home`). */
export const PUBLIC_HOME = '/';

/** Live sessions (webinars). Legacy: `/webinars`. */
export const LIVE_PUBLIC_BASE = '/live';
export const LIVE_APP_BASE = '/app/live';

/** Office Hours. Legacy: `/office-hours`. */
export const OFFICE_HOURS_PUBLIC_BASE = '/office-hours';
export const OFFICE_HOURS_APP_BASE = '/app/office-hours';
export const OFFICE_HOURS_PUBLIC_BASE_LEGACY = '/office-hours';
export const OFFICE_HOURS_APP_BASE_LEGACY = '/app/office-hours';

/** Podcast Network. */
export const PODCAST_NETWORK_PUBLIC_BASE = '/podcast-network';
export const PODCAST_NETWORK_APP_BASE = '/app/podcast-network';
export const PODCAST_NETWORK_APP_BASE_LEGACY = '/app/podcast-network';

export function liveSessionPath(base: string, id: string): string {
  return `${base}/${encodeURIComponent(id)}`;
}

export function officeHoursPath(base: string, id: string): string {
  return `${base}/${encodeURIComponent(id)}`;
}

export function podcastShowPublicPath(showId: string): string {
  return `${PODCAST_NETWORK_PUBLIC_BASE}/${encodeURIComponent(showId)}`;
}
