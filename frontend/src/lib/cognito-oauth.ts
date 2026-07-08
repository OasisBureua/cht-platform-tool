import { resolveAppBaseUrl } from '../config/app-urls';

const PKCE_STORAGE_PREFIX = 'cognito-oauth-';

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

export function getCognitoCallbackUrl(fromPath?: string): string {
  const base = resolveAppBaseUrl().replace(/\/$/, '');
  const callbackBase = `${base}/auth/callback`;
  if (fromPath && fromPath !== '/' && fromPath !== 'undefined') {
    return `${callbackBase}?from=${encodeURIComponent(fromPath)}`;
  }
  return callbackBase;
}

export interface CognitoOAuthState {
  verifier: string;
  redirectUri: string;
  from?: string;
}

export function consumeCognitoOAuthState(state: string | null): CognitoOAuthState | null {
  if (!state) return null;
  try {
    const raw = sessionStorage.getItem(`${PKCE_STORAGE_PREFIX}${state}`);
    sessionStorage.removeItem(`${PKCE_STORAGE_PREFIX}${state}`);
    if (!raw) return null;
    return JSON.parse(raw) as CognitoOAuthState;
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
  const logoutUri = resolveAppBaseUrl().replace(/\/$/, '');

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

  const redirectUri = getCognitoCallbackUrl(fromPath);
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
    scope: 'email openid profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  if (identityProvider) {
    params.set('identity_provider', identityProvider);
  }

  return `${domain}/oauth2/authorize?${params.toString()}`;
}
