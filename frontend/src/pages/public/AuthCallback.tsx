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
    if (!hash) {
      setError('No OAuth response received.');
      return;
    }

    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const errorDesc = params.get('error_description');

    if (errorDesc) {
      setError(decodeURIComponent(errorDesc));
      return;
    }

    if (!accessToken) {
      setError('Missing access token.');
      return;
    }

    let cancelled = false;
    loginOAuth(accessToken).then((result) => {
      if (cancelled) return;
      if (result.error) {
        setError(result.error.message || 'Sign-in failed.');
        return;
      }
      const from = searchParams.get('from') || '/app/home';
      navigate(from, { replace: true });
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
