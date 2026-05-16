import { useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { buildOAuthAuthorizeUrl } from '../../lib/supabase-oauth';
import { getPostLoginPath } from '../../utils/postLoginRedirect';

export default function Login() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleOAuth = (provider: 'google') => {
    setError(null);
    setOauthLoading(provider);
    const url = buildOAuthAuthorizeUrl(provider, from);
    // Debug: verify redirect_to is in URL (should contain testapp.communityhealth.media/auth/callback)
    if (import.meta.env.DEV) console.log('[OAuth] Redirecting to:', url);
    window.location.href = url;
  };

  // Only navigate after session is validated (isLoading=false) - prevents flash/redirect loop
  // where app renders before authHeaderGetter is updated, causing 401 on first API call
  if (isAuthenticated && !isLoading) {
    return <Navigate to={getPostLoginPath(user?.role, from)} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    const { error: err } = await login(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      return;
    }
    // Don't navigate here - let the isAuthenticated check above render <Navigate> after state updates
  };

  // Show loading after successful login while validating session
  if (isAuthenticated && isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-white">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mb-4" />
          <p className="text-gray-600">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-white">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/10 bg-white shadow-xl">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Your clinical library is waiting.
          </p>
        </div>

        {/* Form section */}
        <div className="p-6">
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Input
              id="email"
              label="Email address"
              type="email"
              placeholder="johndoe@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-700">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="font-medium text-gray-900 underline hover:text-gray-700 text-sm"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
            >
              {submitting ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {oauthLoading === 'google' ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </button>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link
              to="/join"
              className="font-medium text-gray-900 underline hover:text-gray-700"
            >
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function Input({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
}: {
  id?: string;
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">{label}</label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}
