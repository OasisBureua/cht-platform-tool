import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Award, DollarSign, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
];

const PLATFORM_HOME = '/app/home';

/** Base URL for OAuth redirect - must be in GoTrue's Redirect URLs allowlist. Falls back to current origin. */
function getOAuthRedirectBase(): string {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export default function Join() {
  const { isAuthenticated, signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profession, setProfession] = useState('');
  const [npiNumber, setNpiNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to={PLATFORM_HOME} replace />;
  }

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setError(null);
    setOauthLoading(provider);
    try {
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${getOAuthRedirectBase()}/auth/callback?from=${encodeURIComponent(PLATFORM_HOME)}`,
        },
      });
      if (err) {
        setError(err.message || 'OAuth failed.');
        setOauthLoading(null);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError('OAuth not configured. Contact support.');
    } catch {
      setError('Sign-in failed.');
    }
    setOauthLoading(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    const npi = npiNumber.replace(/\D/g, '');
    if (npi.length !== 10) {
      setError('NPI number must be 10 digits.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await signUp(email, password, { firstName, lastName, profession, npiNumber: npi });
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Sign up failed. Please try again.');
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-600">
            We&apos;ve sent a verification link to <strong>{email}</strong>. Click the link to verify your account, then you can sign in.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 md:py-16">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* =====================
            LEFT: VALUE
            ===================== */}
        <div className="space-y-6">
          <p className="text-sm font-semibold text-gray-600">Join</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Join CHT
          </h1>

          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            CHT is a platform for healthcare professionals to participate in
            accredited education, surveys, and research opportunities — and
            earn CME credits and honoraria.
          </p>

          <div className="space-y-4">
            <ValueRow
              icon={<Award className="h-5 w-5" />}
              title="Earn CME credits"
              text="Participate in accredited educational programs."
            />
            <ValueRow
              icon={<DollarSign className="h-5 w-5" />}
              title="Get paid for your time"
              text="Receive honoraria for eligible activities."
            />
            <ValueRow
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="Simple participation"
              text="Complete short videos and surveys on your schedule."
            />
          </div>
        </div>

        {/* =====================
            RIGHT: FORM
            ===================== */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Create your account
          </h2>

          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
            For healthcare professionals only.
          </p>

          {/* OAuth sign-up — creates CHT account and redirects to platform */}
          <div className="mt-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {oauthLoading === 'google' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <GoogleIcon />
                )}
                Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth('apple')}
                disabled={!!oauthLoading}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {oauthLoading === 'apple' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <AppleIcon />
                )}
                Apple
              </button>
            </div>
            <p className="text-center text-xs text-gray-500">
              Sign up with Google or Apple
            </p>
          </div>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or create account with email</span>
              </div>
            </div>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Input
              label="First name"
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              label="Last name"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
            <Input
              label="Email address"
              type="email"
              placeholder="jane@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <Select
              label="Profession"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              options={PROFESSION_OPTIONS}
              required
            />
            <Input
              label="NPI number"
              type="text"
              placeholder="10-digit National Provider Identifier"
              value={npiNumber}
              onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              required
              maxLength={10}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-70"
            >
              {submitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <Link to="/privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>
            .
          </p>

          <div className="mt-6 text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-gray-900 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================
   Components
   ===================== */

function ValueRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
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
  minLength,
  maxLength,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
