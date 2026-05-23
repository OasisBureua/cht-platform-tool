/** GoTrue OAuth URL helpers - no Supabase client, so the app loads without VITE_SUPABASE_ANON_KEY. */
import { resolveAppBaseUrl } from '../config/app-urls';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';

export function getOAuthRedirectBase(): string {
  return resolveAppBaseUrl();
}

export function buildOAuthAuthorizeUrl(provider: 'google', fromPath?: string): string {
  const base = getOAuthRedirectBase();
  const callbackBase = `${base}/auth/callback`;
  const redirectTo =
    fromPath && fromPath !== '/' && fromPath !== 'undefined'
      ? `${callbackBase}?from=${encodeURIComponent(fromPath)}`
      : callbackBase;
  const params = new URLSearchParams({ provider, redirect_to: redirectTo });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}
