import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getPostLoginPath } from '../../utils/postLoginRedirect';

/**
 * OAuth callback page. GoTrue redirects here after Google/Apple sign-in.
 * URL hash contains: access_token, refresh_token, etc.
 * Capture hash at module load (before Supabase client can clear it).
 */
const INITIAL_HASH =
  typeof window !== 'undefined' && window.location.hash ? window.location.hash.slice(1) : '';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = INITIAL_HASH || window.location.hash?.slice(1);
    const query = window.location.search?.slice(1);
    const hashParams = hash ? new URLSearchParams(hash) : null;
    const queryParams = query ? new URLSearchParams(query) : null;

    const params = hashParams ?? queryParams;
    if (params) {
      const errorDesc = params.get('error_description');
      if (errorDesc) {
        setError(decodeURIComponent(errorDesc));
        return;
      }
    }

    const accessToken = hashParams?.get('access_token') ?? queryParams?.get('access_token');
    if (!accessToken || !accessToken.trim()) {
      setError('Missing access token. Please try signing in again.');
      return;
    }

    let cancelled = false;
    loginOAuth(accessToken.trim()).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message || 'Sign-in failed.');
        return;
      }
      const fromParam = searchParams.get('from');
      const fromPath = fromParam && fromParam !== 'undefined' ? fromParam : undefined;
      navigate(getPostLoginPath(result.role, fromPath), { replace: true });
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
