/** Hosts where frontend + API share one origin (/api on same domain). */
const SAME_ORIGIN_API_SUFFIX = 'testapp.communityhealth.media';

const DEVAPP_HOST = 'devapp.communityhealth.media';

/** Platform / testapp host (not devapp). Used to hold the public marketing home until launch. */
export function isTestappHost(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return hostname === SAME_ORIGIN_API_SUFFIX || hostname.endsWith(`.${SAME_ORIGIN_API_SUFFIX}`);
}

/** Dev environment host (Companion nav/UI gated here for now). */
export function isDevappHost(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): boolean {
  return hostname === DEVAPP_HOST || hostname.endsWith(`.${DEVAPP_HOST}`);
}

/**
 * Companion (chatbot) is enabled on devapp, and locally for Vite DEV.
 * Hidden on testapp / prod until cutover.
 */
export function isCompanionEnabled(
  hostname = typeof window !== 'undefined' ? window.location.hostname : '',
): boolean {
  if (isDevappHost(hostname)) return true;
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
  }
  return false;
}

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function sameOriginApiBase(): string {
  if (typeof window === 'undefined') return '/api';
  return `${window.location.origin}/api`;
}

/** Backend API base URL: build-time VITE_API_URL, else same-origin /api on testapp hosts. */
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

/** App origin for OAuth redirects: build-time VITE_APP_URL, else current origin. */
export function resolveAppBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_APP_URL?.trim();
  if (fromEnv) return trimTrailingSlash(fromEnv);
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
}
