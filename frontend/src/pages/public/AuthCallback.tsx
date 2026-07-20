import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPostLoginPath } from '../../utils/postLoginRedirect';
import { cognitoAuthEnabled } from '../../lib/auth-config';
import {
  consumeCognitoOAuthState,
  getCognitoCallbackUrl,
} from '../../lib/cognito-oauth';

/**
 * OAuth callback page.
 * Cognito PKCE: ?code=...&state=... → POST /auth/cognito/callback
 * Legacy GoTrue: #access_token=... → POST /auth/login-oauth
 */
const INITIAL_HASH =
  typeof window !== 'undefined' && window.location.hash ? window.location.hash.slice(1) : '';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeCognitoCallback, loginOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  /** Prevent Strict Mode / dep churn from starting the exchange twice. */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const errorDesc = searchParams.get('error_description');
    if (errorDesc) {
      setError(decodeURIComponent(errorDesc));
      return;
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const fromParam = searchParams.get('from') || undefined;
    const fromPath = fromParam && fromParam !== 'undefined' ? fromParam : undefined;

    if (code && cognitoAuthEnabled) {
      let cancelled = false;
      const oauthState = consumeCognitoOAuthState(state);
      const redirectUri = oauthState?.redirectUri || getCognitoCallbackUrl(oauthState?.from);
      const codeVerifier = oauthState?.verifier;

      if (!codeVerifier) {
        setError('Missing PKCE verifier. Please try signing in again.');
        return;
      }

      completeCognitoCallback(code, redirectUri, codeVerifier).then((result) => {
        if (cancelled) return;
        if (result.error) {
          setError(result.error.message || 'Sign-in failed.');
          return;
        }
        navigate(
          getPostLoginPath(result.role, oauthState?.from || fromPath),
          { replace: true },
        );
      });

      return () => {
        cancelled = true;
      };
    }

    const hash = INITIAL_HASH || window.location.hash?.slice(1);
    const hashParams = hash ? new URLSearchParams(hash) : null;
    const accessToken = hashParams?.get('access_token') ?? searchParams.get('access_token');

    if (!accessToken?.trim()) {
      setError('Missing authorization response. Please try signing in again.');
      return;
    }

    let cancelled = false;
    loginOAuth(accessToken.trim()).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message || 'Sign-in failed.');
        return;
      }
      navigate(getPostLoginPath(result.role, fromPath), { replace: true });
    });

    return () => {
      cancelled = true;
    };
    // Intentionally omit callback fn deps — startedRef guards a single exchange per code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-white px-4 py-8">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-red-800">Sign-in didn’t finish</p>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-white px-4 py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mb-4" />
      <p className="text-gray-700 font-medium">Completing sign-in…</p>
      <p className="mt-1 text-sm text-gray-500">You’ll be redirected in a moment.</p>
    </div>
  );
}
