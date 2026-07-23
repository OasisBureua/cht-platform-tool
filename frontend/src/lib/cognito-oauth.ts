import { resolveAppBaseUrl } from '../config/app-urls';

const PKCE_STORAGE_PREFIX = 'cognito-oauth-';

export interface CognitoOAuthState {
  verifier: string;
  redirectUri: string;
  from?: string;
}

/** Survives Strict Mode double-mount so AuthCallback can reuse the same PKCE verifier. */
let lastConsumedOAuth: { state: string; data: CognitoOAuthState } | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomBase64Url(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Cognito callback / logout URLs must match the app client allowlist exactly.
 * Strip query/hash so stale sessionStorage values with ?from= cannot break token exchange.
 */
export function normalizeCognitoRedirectUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    u.search = '';
    u.hash = '';
    const path = u.pathname.replace(/\/$/, '') || '';
    return path ? `${u.origin}${path}` : u.origin;
  } catch {
    return trimmed.split('#')[0].split('?')[0].replace(/\/$/, '');
  }
}

/**
 * Cognito callback URL. Must match callback_urls exactly (no query string).
 * Return path is stored in PKCE sessionStorage via `state`, not on redirect_uri.
 */
export function getCognitoCallbackUrl(_fromPath?: string): string {
  const base = resolveAppBaseUrl().replace(/\/$/, '');
  return normalizeCognitoRedirectUri(`${base}/auth/callback`);
}

export function consumeCognitoOAuthState(state: string | null): CognitoOAuthState | null {
  if (!state) return null;
  // React Strict Mode remounts AuthCallback and re-runs the effect; keep the last
  // consumed PKCE payload in memory so the second pass does not lose the verifier.
  if (lastConsumedOAuth?.state === state) {
    return lastConsumedOAuth.data;
  }
  try {
    const raw = sessionStorage.getItem(`${PKCE_STORAGE_PREFIX}${state}`);
    sessionStorage.removeItem(`${PKCE_STORAGE_PREFIX}${state}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as CognitoOAuthState;
    data.redirectUri = normalizeCognitoRedirectUri(data.redirectUri);
    lastConsumedOAuth = { state, data };
    return data;
  } catch {
    return null;
  }
}

/**
 * Build Cognito Hosted UI authorize URL with PKCE (S256).
 * Optional identityProvider: "Google" when Google IdP is wired in Cognito.
 */
export function buildCognitoLogoutUrl(): string {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN?.replace(/\/$/, '');
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
  // Must match Cognito logout_urls exactly (Terraform: https://{domain_name}).
  const logoutUri = normalizeCognitoRedirectUri(resolveAppBaseUrl());

  if (!domain || !clientId) {
    throw new Error('Cognito logout is not configured.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `${domain}/logout?${params.toString()}`;
}

export async function buildCognitoAuthorizeUrl(
  identityProvider?: 'Google',
  fromPath?: string,
): Promise<string> {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN?.replace(/\/$/, '');
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();

  if (!domain || !clientId) {
    throw new Error('Cognito OAuth is not configured.');
  }

  const redirectUri = getCognitoCallbackUrl();
  const verifier = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);
  const state = randomBase64Url(16);

  const stored: CognitoOAuthState = {
    verifier,
    redirectUri,
    from: fromPath,
  };
  sessionStorage.setItem(`${PKCE_STORAGE_PREFIX}${state}`, JSON.stringify(stored));

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'email openid profile aws.cognito.signin.user.admin',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  if (identityProvider) {
    params.set('identity_provider', identityProvider);
  }

  return `${domain}/oauth2/authorize?${params.toString()}`;
}
