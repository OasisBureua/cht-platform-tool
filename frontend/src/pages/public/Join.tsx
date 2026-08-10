import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Award, Check, ClipboardCheck, DollarSign } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { buildOAuthAuthorizeUrl } from '../../lib/supabase-oauth';
import { buildCognitoAuthorizeUrl } from '../../lib/cognito-oauth';
import {
  cognitoAuthEnabled,
  googleOAuthEnabled,
  googleOAuthMigrationMessage,
  mediahubAuthDecommissioned,
  recaptchaEnabled,
} from '../../lib/auth-config';
import { GOOGLE_OAUTH_DISCLAIMER } from '../../lib/auth-branding';
import { executeRecaptcha } from '../../lib/recaptcha';
import { signupProfessionSelectOptions, professionRequiresNpi } from '../../data/profession-options';
import {
  US_STATE_SELECT_OPTIONS,
  normalizeUsStateCode,
  normalizeUsZip5,
} from '../../data/us-states';
import {
  SIGNUP_PASSWORD_RULES,
  evaluatePasswordRules,
  isPasswordValid,
} from '../../lib/password-rules';
import { RecaptchaNotice } from '../../components/RecaptchaNotice';
import CityTypeahead from '../../components/forms/CityTypeahead';

const JOIN_PROFESSION_OPTIONS = signupProfessionSelectOptions().map((o, i) =>
  i === 0 ? { ...o, label: 'Select your role' } : { ...o },
);

const PLATFORM_HOME = '/app/home';

export default function Join() {
  const { isAuthenticated, signUp } = useAuth();
  const signupEnabled = cognitoAuthEnabled || !mediahubAuthDecommissioned;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profession, setProfession] = useState('');
  const [npiNumber, setNpiNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [npiVerifying, setNpiVerifying] = useState(false);
  const [npiVerified, setNpiVerified] = useState<boolean | null>(null);

  const requiresNpi = professionRequiresNpi(profession);
  const passwordRules = useMemo(() => evaluatePasswordRules(password), [password]);
  const passwordOk = isPasswordValid(password);
  const npiDigits = npiNumber.replace(/\D/g, '');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const stateCode = normalizeUsStateCode(state);
  const zipOk = !!normalizeUsZip5(zipCode);
  const npiOk = !requiresNpi || (npiDigits.length === 10 && npiVerified !== false);

  const canSubmit =
    signupEnabled &&
    !submitting &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailOk &&
    passwordOk &&
    !!profession &&
    npiOk &&
    !!stateCode &&
    zipOk;

  if (isAuthenticated) {
    return <Navigate to={PLATFORM_HOME} replace />;
  }

  const handleOAuth = async (provider: 'google') => {
    if (!googleOAuthEnabled) {
      setError(googleOAuthMigrationMessage);
      return;
    }
    setError(null);
    setOauthLoading(provider);
    try {
      const url = cognitoAuthEnabled
        ? await buildCognitoAuthorizeUrl('Google', PLATFORM_HOME)
        : buildOAuthAuthorizeUrl(provider, PLATFORM_HOME);
      window.location.href = url;
    } catch (err) {
      setOauthLoading(null);
      setError(err instanceof Error ? err.message : 'Could not start Google sign-up.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError('Please complete all required fields before continuing.');
      return;
    }

    const npi = npiDigits;
    const zip = normalizeUsZip5(zipCode)!;

    setSubmitting(true);
    try {
      let recaptchaToken: string | undefined;
      if (recaptchaEnabled) {
        recaptchaToken = await executeRecaptcha('signup');
      }
      const { error: err } = await signUp(
        email,
        password,
        {
          firstName,
          lastName,
          profession,
          npiNumber: requiresNpi ? npi || undefined : undefined,
          institution: institution.trim() || undefined,
          city: city.trim() || undefined,
          state: stateCode!,
          zipCode: zip,
        },
        recaptchaToken,
      );
      if (err) {
        setError(err.message || 'Sign up failed. Please try again.');
        return;
      }
      setSuccess(true);
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

  if (success) {
    return (
      <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 md:py-16">
        <div className="w-full max-w-md rounded-2xl border border-gray-200/90 bg-white/95 p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.12)]">
          <h2 className="text-balance text-xl font-semibold text-gray-900">Check your email</h2>
          <p className="text-pretty mt-2 text-sm text-gray-600">
            {cognitoAuthEnabled ? (
              <>
                If this email can be registered, you&apos;ll receive a 6-digit verification code from{' '}
                <strong>noreply@communityhealth.media</strong>. Already have an account?{' '}
                <Link to="/login" className="font-medium text-gray-900 underline">
                  Sign in
                </Link>{' '}
                or{' '}
                <Link to="/forgot-password" className="font-medium text-gray-900 underline">
                  reset your password
                </Link>
                .
              </>
            ) : (
              <>
                If this email can be registered, you&apos;ll receive a verification link. Already have
                an account?{' '}
                <Link to="/login" className="font-medium text-gray-900 underline">
                  Sign in
                </Link>
                .
              </>
            )}
          </p>
          <Link
            to={
              cognitoAuthEnabled
                ? `/verify-email?email=${encodeURIComponent(email.trim())}`
                : '/login'
            }
            className="mt-6 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] transition-[background-color,transform] duration-200 ease-out hover:bg-brand-700 active:scale-[0.96]"
          >
            {cognitoAuthEnabled ? 'Enter verification code' : 'Go to Login'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-gray-50/90 via-white to-white px-4 py-10 sm:px-6 sm:py-12 md:py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-14">
        <aside className="order-2 space-y-5 lg:sticky lg:top-24 lg:order-1">
          <header className="text-center lg:text-left">
            <p className="text-sm font-semibold tracking-wide text-brand-800 dark:text-brand-400">
              Join
            </p>
            <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
              Join CHT
            </h1>
            <p className="text-pretty mx-auto mt-3 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base lg:mx-0">
              CHT is a platform for healthcare professionals to participate in accredited education,
              surveys, and research opportunities, and to earn CME credits and honoraria.
            </p>
          </header>

          <ul className="mx-auto flex max-w-md list-none flex-col gap-3 lg:mx-0 lg:max-w-none" role="list">
            <li>
              <ValueRow
                icon={<Award className="h-5 w-5" aria-hidden />}
                title="Earn CME credits"
                text="Participate in accredited educational programs."
              />
            </li>
            <li>
              <ValueRow
                icon={<DollarSign className="h-5 w-5" aria-hidden />}
                title="Honoraria"
                text="Receive payment for eligible activities."
              />
            </li>
            <li>
              <ValueRow
                icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
                title="On your schedule"
                text="Short videos and surveys when it works for you."
              />
            </li>
          </ul>
        </aside>

        <div className="order-1 w-full min-w-0 lg:order-2">
          <div className="rounded-2xl border border-gray-200/90 bg-white/95 p-5 shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.14)] sm:p-6">
            <h2 className="text-balance text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">
              Create your account
            </h2>

            <p className="text-pretty mt-1 text-sm leading-snug text-gray-600">
              Join the Community Health platform.
            </p>

            {googleOAuthEnabled ? (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthLoading}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_6px_16px_-8px_rgba(0,0,0,0.08)] transition-[background-color,transform,box-shadow,color] duration-200 ease-out hover:bg-gray-50/90 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                >
                  {oauthLoading === 'google' ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continue with Google
                </button>
                <p className="text-center text-xs text-gray-500">{GOOGLE_OAUTH_DISCLAIMER}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                {googleOAuthMigrationMessage}
              </div>
            )}

            <div className="mt-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="bg-white/95 px-3 text-gray-500">Or create account with email</span>
                </div>
              </div>
            </div>

            <form className="mt-4" onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="mb-3 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2.5 text-sm text-red-800 shadow-[inset_0_0_0_1px_rgba(254,202,202,0.6)]">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3 sm:gap-y-3">
                <div className="min-w-0">
                  <Input
                    label="First name"
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="min-w-0">
                  <Input
                    label="Last name"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
                <div className="min-w-0">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="jane@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Input
                    label="Password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <ul className="space-y-1 pt-1" aria-live="polite">
                    {SIGNUP_PASSWORD_RULES.map((rule) => {
                      const ok = passwordRules[rule.id];
                      return (
                        <li key={rule.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={[
                              'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                              ok ? 'bg-green-600 text-white' : 'bg-gray-200 text-transparent',
                            ].join(' ')}
                            aria-hidden
                          >
                            <Check className="h-2.5 w-2.5" strokeWidth={3} />
                          </span>
                          <span className={ok ? 'text-green-800' : 'text-gray-500'}>
                            {rule.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="min-w-0 sm:col-span-2">
                  <Select
                    label="Role"
                    value={profession}
                    onChange={(e) => {
                      const v = e.target.value;
                      setProfession(v);
                      setNpiVerified(null);
                      if (!professionRequiresNpi(v)) setNpiNumber('');
                    }}
                    options={JOIN_PROFESSION_OPTIONS}
                    required
                  />
                  {profession && !professionRequiresNpi(profession) ? (
                    <p className="mt-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                      <strong>Note:</strong> NPI is not required for your role. Honorarium programs
                      are designed for licensed healthcare professionals: you can still access all
                      educational content and events.
                    </p>
                  ) : null}
                </div>

                {requiresNpi && (
                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-900">
                      NPI number
                      <span className="ml-1 text-red-600" aria-hidden>
                        *
                      </span>
                      <span className="sr-only"> (required)</span>
                    </label>
                    <p className="text-xs text-gray-500">
                      Enter your 10-digit National Provider Identifier (NPI). Required for licensed
                      healthcare roles.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="10-digit NPI"
                        value={npiNumber}
                        onChange={(e) => {
                          setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setNpiVerified(null);
                        }}
                        required
                        maxLength={10}
                        aria-describedby="npi-help"
                        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                      />
                      <button
                        type="button"
                        disabled={npiDigits.length !== 10 || npiVerifying}
                        onClick={async () => {
                          setNpiVerifying(true);
                          setNpiVerified(null);
                          try {
                            const res = await fetch(
                              `https://npiregistry.cms.hhs.gov/api/?number=${npiDigits}&version=2.1`,
                            );
                            const data = await res.json();
                            setNpiVerified(data.result_count > 0);
                          } catch {
                            setNpiVerified(null);
                          } finally {
                            setNpiVerifying(false);
                          }
                        }}
                        className="shrink-0 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-brand-700 active:scale-[0.96] disabled:opacity-50"
                      >
                        {npiVerifying ? 'Verifying…' : 'Verify'}
                      </button>
                    </div>
                    <p id="npi-help" className="sr-only">
                      NPI must be exactly 10 digits.
                    </p>
                    {npiVerified === true && (
                      <p className="text-xs font-medium text-green-700">NPI verified successfully.</p>
                    )}
                    {npiVerified === false && (
                      <p className="text-xs font-medium text-red-600">
                        NPI not found in the NPPES registry. Please check and try again.
                      </p>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-100/90 pt-3 shadow-[0_-1px_0_0_rgba(255,255,255,0.85)] sm:col-span-2">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Practice location
                  </p>
                  <p className="mb-3 text-xs text-gray-500">
                    Institution and city are optional. State and 5-digit ZIP are required.
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3">
                    <div className="min-w-0 sm:col-span-2">
                      <Input
                        label="Institution / Hospital"
                        placeholder="e.g., Mayo Clinic"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        optional
                      />
                    </div>
                    <div className="min-w-0">
                      <Select
                        label="State"
                        value={state}
                        onChange={(e) => {
                          setState(e.target.value);
                          setCity('');
                        }}
                        options={US_STATE_SELECT_OPTIONS}
                        required
                      />
                    </div>
                    <div className="min-w-0">
                      <Input
                        label="ZIP code"
                        placeholder="12345"
                        value={zipCode}
                        onChange={(e) =>
                          setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))
                        }
                        maxLength={5}
                        required
                        inputMode="numeric"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <CityTypeahead
                        label="City"
                        value={city}
                        onChange={setCity}
                        stateCode={state || undefined}
                        optional
                      />
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="w-full rounded-full bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_12px_32px_-12px_rgba(0,0,0,0.35)] transition-[background-color,transform,box-shadow,opacity] duration-200 ease-out hover:bg-brand-700 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
                  >
                    {!signupEnabled
                      ? 'Account creation temporarily unavailable'
                      : submitting
                        ? 'Creating account...'
                        : 'Create account'}
                  </button>
                  {!canSubmit && signupEnabled ? (
                    <p className="mt-2 text-center text-xs text-gray-500">
                      Complete required fields (including password rules, role
                      {requiresNpi ? ', NPI' : ''}, state, and ZIP) to continue.
                    </p>
                  ) : null}
                </div>
              </div>
            </form>

            <p className="mt-3 text-xs text-gray-500">
              By continuing, you agree to our{' '}
              <Link to="/privacy" className="underline hover:text-gray-700">
                Privacy Policy
              </Link>
              .
            </p>

            <RecaptchaNotice />

            <div className="mt-4 text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-gray-900 hover:underline">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex gap-3 rounded-2xl border border-gray-200/75 bg-white/70 p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_10px_32px_-18px_rgba(0,0,0,0.08)] sm:p-4 sm:pr-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200/90 bg-gray-50/90 text-gray-900 shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-pretty mt-0.5 text-sm leading-relaxed text-gray-600">{text}</p>
      </div>
    </div>
  );
}

function FieldLabel({
  label,
  required,
  optional,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="text-sm font-semibold text-gray-900">
      {label}
      {required ? (
        <>
          <span className="ml-1 text-red-600" aria-hidden>
            *
          </span>
          <span className="sr-only"> (required)</span>
        </>
      ) : null}
      {optional ? <span className="ml-1 font-normal text-gray-500">(optional)</span> : null}
    </label>
  );
}

function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  optional,
  minLength,
  maxLength,
  autoComplete,
  inputMode,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  optional?: boolean;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} optional={optional} />
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
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
    <div className="space-y-1.5">
      <FieldLabel label={label} required={required} />
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] transition-[border-color,box-shadow] duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
      >
        {options.map((opt) => (
          <option key={opt.value || 'empty'} value={opt.value}>
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
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
