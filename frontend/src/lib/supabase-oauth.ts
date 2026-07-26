/** GoTrue OAuth URL helpers - no Supabase client, so the app loads without VITE_SUPABASE_ANON_KEY. */
import { resolveAppBaseUrl } from '../config/app-urls';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';

export function getOAuthRedirectBase(): string {
  return resolveAppBaseUrl();
}

/**
 * GoTrue redirect_to must stay allowlist-safe: no query string on the callback.
 * Post-login return path is not embedded in redirect_to (same pattern as Cognito).
 */
export function buildOAuthAuthorizeUrl(provider: 'google', _fromPath?: string): string {
  const base = getOAuthRedirectBase().replace(/\/$/, '');
  const redirectTo = `${base}/auth/callback`;
  const params = new URLSearchParams({ provider, redirect_to: redirectTo });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}
