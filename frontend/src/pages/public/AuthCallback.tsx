import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * OAuth callback page. Supabase redirects here after Google/Apple sign-in.
 * URL hash contains: access_token, refresh_token, etc.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    const query = window.location.search?.slice(1);
    const hashParams = hash ? new URLSearchParams(hash) : null;
    const queryParams = query ? new URLSearchParams(query) : null;

    // Debug: log OAuth callback URL structure (no token values)
    const debugInfo = {
      hasHash: !!hash,
      hashLength: hash?.length ?? 0,
      hasQuery: !!query,
      hashKeys: hashParams ? [...hashParams.keys()] : [],
      queryKeys: queryParams ? [...queryParams.keys()] : [],
    };
    console.log('[OAuth callback]', debugInfo);

    const params = hashParams ?? queryParams;
    if (!params) {
      setError('No OAuth response received.');
      return;
    }

    // GoTrue typically puts tokens in hash; fallback to query if redirect differs
    const accessToken = hashParams?.get('access_token') ?? queryParams?.get('access_token');
    const errorDesc = params.get('error_description');
    const errorCode = params.get('error');

    if (errorDesc) {
      console.log('[OAuth callback] error:', { error: errorCode, error_description: errorDesc });
      setError(decodeURIComponent(errorDesc));
      return;
    }

    if (!accessToken) {
      console.warn('[OAuth callback] Missing access_token. Available params:', debugInfo.hashKeys.length ? debugInfo.hashKeys : debugInfo.queryKeys);
      setError('Missing access token.');
      return;
    }

    console.log('[OAuth callback] Token received, length:', accessToken.length);

    let cancelled = false;
    loginOAuth(accessToken).then((result) => {
      if (cancelled) return;
      if (result.error) {
        console.error('[OAuth callback] loginOAuth failed:', result.error.message);
        setError(result.error.message || 'Sign-in failed.');
        return;
      }
      if (result.profileComplete === false) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      const from = searchParams.get('from');
      if (from) {
        navigate(from, { replace: true });
        return;
      }
      navigate(result.role === 'ADMIN' ? '/admin' : '/app/home', { replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [loginOAuth, navigate, searchParams]);

  if (error) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <a
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-gray-900 hover:underline"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 py-8">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mb-4" />
      <p className="text-gray-600">Completing sign-in...</p>
    </div>
  );
}
