/** Hosts where frontend + API share one origin (/api on same domain). */
const SAME_ORIGIN_API_HOSTS = [
  'testapp.communityhealth.media',
  'app.communityhealth.media',
] as const;

function isSameOriginApiHost(hostname: string): boolean {
  return SAME_ORIGIN_API_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`),
  );
}

/**
 * Platform hosts that hold the public marketing homepage until launch
 * (testapp + branded app. alias). Not devapp.
 */
export function isTestappHost(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): boolean {
  return isSameOriginApiHost(hostname);
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function sameOriginApiBase(): string {
  if (typeof window === 'undefined') return '/api';
  return `${window.location.origin}/api`;
}

/** Backend API base URL: build-time VITE_API_URL, else same-origin /api on platform hosts. */
export function resolveApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (typeof window !== 'undefined' && isSameOriginApiHost(window.location.hostname)) {
    return sameOriginApiBase();
  }
  return '/api';
}

/**
 * App origin for OAuth redirects / logout.
 * On platform aliases (testapp + app.), always use the current browser origin so
 * Cognito redirect_uri matches the host where the PKCE verifier was stored in
 * sessionStorage. A baked-in VITE_APP_URL (e.g. testapp) would otherwise send
 * app. users to a different origin and fail with "Missing PKCE verifier".
 */
export function resolveAppBaseUrl(): string {
  if (typeof window !== 'undefined' && isSameOriginApiHost(window.location.hostname)) {
    return window.location.origin;
  }
  const fromEnv = import.meta.env.VITE_APP_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}
