import { useState } from 'react';
import { Link, useLocation, Navigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import { buildOAuthAuthorizeUrl } from '../../lib/supabase-oauth';
import { buildCognitoAuthorizeUrl } from '../../lib/cognito-oauth';
import { cognitoAuthEnabled, googleOAuthEnabled, googleOAuthMigrationMessage, recaptchaEnabled } from '../../lib/auth-config';
import { GOOGLE_OAUTH_DISCLAIMER } from '../../lib/auth-branding';
import { executeRecaptcha } from '../../lib/recaptcha';
import { getPostLoginPath } from '../../utils/postLoginRedirect';
import { RecaptchaNotice } from '../../components/RecaptchaNotice';
import { AuthMigrationNotice } from '../../components/auth/AuthMigrationNotice';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';

export default function Login() {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, login, completeMfaLogin, completeMfaSetupLogin } = useAuth();
  const fromLocation = (
    location.state as { from?: { pathname: string; search?: string } } | null
  )?.from;
  const from = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}`
    : undefined;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [mfaSession, setMfaSession] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaSetup, setMfaSetup] = useState<{
    session: string;
    secretCode: string;
    otpauthUri: string;
  } | null>(null);
  const [showManualKey, setShowManualKey] = useState(false);

  const handleOAuth = async (provider: 'google') => {
    if (!googleOAuthEnabled) {
      setError(googleOAuthMigrationMessage);
      return;
    }
    setError(null);
    setOauthLoading(provider);
    try {
      const url = cognitoAuthEnabled
        ? await buildCognitoAuthorizeUrl('Google', from)
        : buildOAuthAuthorizeUrl(provider, from);
      if (import.meta.env.DEV) console.log('[OAuth] Redirecting to:', url);
      window.location.href = url;
    } catch (err) {
      setOauthLoading(null);
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.');
    }
  };

  // Navigate once bootstrap finishes, or immediately after login sets the profile
  // (login no longer re-triggers /auth/me + isLoading).
  if (isAuthenticated && !isLoading) {
    return <Navigate to={getPostLoginPath(user?.role, from)} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);

    if (!email.trim()) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) { setError('Password is required.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }

    setSubmitting(true);
    try {
      let recaptchaToken: string | undefined;
      if (recaptchaEnabled) {
        // Runs in the browser before any API call, if this hangs, backend logs stay empty.
        recaptchaToken = await executeRecaptcha('login');
      }
      const { error: err, mfa, mfaSetup: setup } = await login(email, password, recaptchaToken);
      if (setup) {
        setMfaSetup(setup);
        setShowManualKey(false);
        return;
      }
      if (mfa?.session) {
        setMfaSession(mfa.session);
        return;
      }
      if (err) {
        setError(err.message || 'Login failed. Please check your credentials.');
        setErrorCode(err.code || null);
        return;
      }
    } catch (captchaErr) {
      setError(
        captchaErr instanceof Error
          ? captchaErr.message
          : 'Captcha verification failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSession) return;
    setError(null);
    setErrorCode(null);
    setSubmitting(true);
    const { error: err } = await completeMfaLogin(email, mfaSession, mfaCode);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'MFA verification failed.');
      setErrorCode(err.code || null);
    }
  };

  const handleMfaSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSetup) return;
    setError(null);
    setErrorCode(null);
    setSubmitting(true);
    const { error: err } = await completeMfaSetupLogin(email, mfaSetup.session, mfaCode);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'MFA setup failed.');
      setErrorCode(err.code || null);
    }
  };

  const backToPassword = () => {
    setMfaSession(null);
    setMfaSetup(null);
    setMfaCode('');
    setError(null);
    setErrorCode(null);
    setShowManualKey(false);
  };

  // Show loading after successful login while validating session
  if (isAuthenticated && isLoading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center bg-background px-4 py-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-brand-600" />
          <p role="status" className="text-muted-foreground">Signing you in…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthLayout
      heading="Welcome back"
      sub="Your clinical library is waiting."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/join"
            state={fromLocation ? { from: fromLocation } : undefined}
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Sign up
          </Link>
        </>
      }
    >
      <div className="mt-8">
          {!mfaSession && !mfaSetup ? (
            <div className="mb-4">
              <AuthMigrationNotice variant="login" />
            </div>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={
              mfaSetup
                ? handleMfaSetupSubmit
                : mfaSession
                  ? handleMfaSubmit
                  : handleLogin
            }
          >
            {error && (
              <div role="alert" className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <p>{error}</p>
                {errorCode === 'EMAIL_NOT_VERIFIED' ? (
                  <p className="mt-2">
                    <Link
                      to={`/verify-email?email=${encodeURIComponent(email.trim())}`}
                      className="font-medium underline hover:no-underline"
                    >
                      Verify your email
                    </Link>
                  </p>
                ) : null}
              </div>
            )}
            {mfaSetup ? (
              <>
                <div className="rounded-card bg-card px-4 py-4 text-sm text-muted-foreground shadow-card">
                  <p className="font-medium text-foreground">Set up authenticator MFA</p>
                  <p className="mt-1">
                    Scan the QR code with an authenticator app, then enter the 6-digit code to finish signing in.
                  </p>
                  <div className="mt-4 flex justify-center rounded-[6px] bg-white p-4">
                    <QRCodeSVG
                      value={mfaSetup.otpauthUri}
                      size={180}
                      level="M"
                      marginSize={1}
                      title="MFA setup QR code"
                    />
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setShowManualKey((v) => !v)}
                      className="rounded-[6px] text-xs font-medium text-brand-600 underline hover:no-underline"
                    >
                      {showManualKey ? 'Hide manual key' : 'Can’t scan? Enter key manually'}
                    </button>
                    {showManualKey && (
                      <p className="mt-2 break-all rounded-[6px] bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                        {mfaSetup.secretCode}
                      </p>
                    )}
                  </div>
                </div>
                <Field
                  id="mfaSetupCode"
                  label="Authentication code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                />
              </>
            ) : mfaSession ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code from your authenticator app.
                </p>
                <Field
                  id="mfaCode"
                  label="Authentication code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  required
                />
              </>
            ) : (
              <>
            <Field
              id="email"
              label="Email address"
              type="email"
              placeholder="johndoe@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Field
              id="password"
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
              </>
            )}

            {!mfaSession && !mfaSetup ? (
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 rounded-[3px] accent-brand-600"
                />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="rounded-[6px] text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>
            ) : (
              <button
                type="button"
                onClick={backToPassword}
                className="rounded-[6px] text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Use a different account
              </button>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting
                ? 'Signing in...'
                : mfaSetup
                  ? 'Verify and continue'
                  : mfaSession
                    ? 'Verify code'
                    : 'Sign in'}
            </Button>
          </form>

          {googleOAuthEnabled && !mfaSession && !mfaSetup ? (
            <div className="mt-6 space-y-3">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="h-px w-full bg-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-card text-sm font-medium text-foreground shadow-card transition-[box-shadow,background-color,scale] duration-150 hover:bg-muted hover:shadow-card-hover motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {oauthLoading === 'google' ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-brand-600" />
                ) : (
                  <GoogleIcon />
                )}
                Continue with Google
              </button>
              <p className="text-center text-xs text-muted-foreground">{GOOGLE_OAUTH_DISCLAIMER}</p>
            </div>
          ) : !mfaSession && !mfaSetup ? (
            <p className="mt-6 rounded-[6px] bg-warning/10 px-4 py-3 text-sm text-warning">
              {googleOAuthMigrationMessage}
            </p>
          ) : null}

          {/* Footer */}
          <RecaptchaNotice />
      </div>
    </AuthLayout>
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
