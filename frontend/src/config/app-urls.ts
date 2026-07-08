/** Hosts where frontend + API share one origin (/api on same domain). */
const SAME_ORIGIN_API_SUFFIX = 'testapp.communityhealth.media';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function sameOriginApiBase(): string {
  if (typeof window === 'undefined') return '/api';
  return `${window.location.origin}/api`;
}

/** Backend API base URL — build-time VITE_API_URL, else same-origin /api on testapp hosts. */
export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith(SAME_ORIGIN_API_SUFFIX)
  ) {
    return sameOriginApiBase();
  }
  return '/api';
}

/** App origin for OAuth redirects — build-time VITE_APP_URL, else current origin. */
export function resolveAppBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}
