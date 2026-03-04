import { createClient } from '@supabase/supabase-js';

// Base URL for GoTrue (client appends /auth/v1)
// VITE_SUPABASE_ANON_KEY must be set - get valid JWT from MediaHub/CHM team (signed with GoTrue secret)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error('VITE_SUPABASE_ANON_KEY is required. Get valid JWT from MediaHub/CHM team.');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** OAuth redirect base - must be in GoTrue's Redirect URLs allowlist. */
export function getOAuthRedirectBase(): string {
  // Hardcode production so OAuth always returns to CHT platform, not MediaHub
  if (typeof window !== 'undefined' && window.location?.hostname?.includes('testapp.communityhealth.media')) {
    return 'https://testapp.communityhealth.media';
  }
  return import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * Build GoTrue authorize URL with redirect_to explicitly set.
 * Fix for Google OAuth: GoTrue requires redirect_to to send users back to the CHT platform.
 * @see Sebastien: GET .../auth/v1/authorize?provider=google&redirect_to=https://testapp.communityhealth.media/auth/callback
 */
export function buildOAuthAuthorizeUrl(provider: 'google' | 'apple', fromPath: string): string {
  const base = getOAuthRedirectBase();
  const redirectTo = `${base}/auth/callback?from=${encodeURIComponent(fromPath)}`;
  const params = new URLSearchParams({
    provider,
    redirect_to: redirectTo,
  });
  return `${supabaseUrl}/auth/v1/authorize?${params.toString()}`;
}
