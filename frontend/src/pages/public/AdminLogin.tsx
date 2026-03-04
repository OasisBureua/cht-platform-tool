import { useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { buildOAuthAuthorizeUrl } from '../../lib/supabase';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    setError(null);
    setOauthLoading('google');
    window.location.href = buildOAuthAuthorizeUrl('google', from);
  };

  if (isAuthenticated && !isLoading) {
    // Admin login page: only allow admins to proceed to /admin
    if (user?.role === 'ADMIN') {
      return <Navigate to={from} replace />;
    }
    // Non-admin logged in: redirect to app
    return <Navigate to="/app/home" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await login(email, password);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
      return;
    }
  };

  if (isAuthenticated && isLoading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mb-4" />
          <p className="text-gray-600">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-12 bg-gray-50">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="bg-gray-900 px-6 py-8 text-center">
          <Shield className="mx-auto h-12 w-12 text-white/90" />
          <h1 className="mt-4 text-xl font-semibold text-white md:text-2xl">
            Admin Sign In
          </h1>
          <p className="mt-2 text-sm text-gray-300">
            Platform administrators only.
          </p>
        </div>

        <div className="p-6">
          <form className="space-y-4" onSubmit={handleLogin}>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Input
              label="Email address"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="relative mt-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={!!oauthLoading}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {oauthLoading === 'google' ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
              ) : (
                <GoogleIcon />
              )}
              Google
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Not an admin?{' '}
            <Link to="/login" className="font-medium text-gray-900 hover:underline">
              HCP Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
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
