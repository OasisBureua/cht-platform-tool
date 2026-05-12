/** GoTrue OAuth URL helpers - no Supabase client, so the app loads without VITE_SUPABASE_ANON_KEY. */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mediahub.communityhealth.media';

export function getOAuthRedirectBase(): string {
  if (typeof window !== 'undefined' && window.location?.hostname?.includes('testapp.communityhealth.media')) {
    return 'https://testapp.communityhealth.media';
  }
  return import.meta.env.VITE_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
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
