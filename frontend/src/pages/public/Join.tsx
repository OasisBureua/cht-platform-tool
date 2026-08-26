import { useEffect, useId, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
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
import { verifyNpiNumber } from '../../api/npi';
import { Button, Card, Field, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

const JOIN_PROFESSION_OPTIONS = signupProfessionSelectOptions().map((o, i) =>
  i === 0 ? { ...o, label: 'Select your role' } : { ...o },
);

const PLATFORM_HOME = '/app/home';

/**
 * The page gutter, matching --page-gutter. Sections run full width and
 * this rail carries the margins, so bands are separated by space rather
 * than by a rule.
 */
const RAIL = 'mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8';

/** Controls share one field treatment: a surface with elevation, no hairline. */
const CONTROL =
  'h-12 w-full rounded-[6px] bg-card px-4 text-base text-foreground shadow-card ' +
  'outline-none placeholder:text-muted-foreground/70 sm:text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export default function Join() {
  const { isAuthenticated, signUp } = useAuth();
  const location = useLocation();
  const fromLocation = (
    location.state as { from?: { pathname: string; search?: string } } | null
  )?.from;
  const returnTo = fromLocation
    ? `${fromLocation.pathname}${fromLocation.search ?? ''}`
    : undefined;
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
  const [npiMeta, setNpiMeta] = useState<{
    providerName?: string;
    providerType?: string;
    duplicate?: boolean;
    error?: string;
  } | null>(null);

  const requiresNpi = professionRequiresNpi(profession);
  const passwordRules = useMemo(() => evaluatePasswordRules(password), [password]);
  const passwordOk = isPasswordValid(password);
  const npiDigits = npiNumber.replace(/\D/g, '');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const stateCode = normalizeUsStateCode(state);
  const zipOk = !!normalizeUsZip5(zipCode);
  // Require a successful registry check (and no duplicate) before create.
  const npiOk =
    !requiresNpi ||
    (npiDigits.length === 10 && npiVerified === true && !npiMeta?.duplicate);

  const runNpiVerify = async (digits: string) => {
    if (digits.length !== 10) return;
    setNpiVerifying(true);
    setNpiVerified(null);
    setNpiMeta(null);
    try {
      const result = await verifyNpiNumber(digits);
      setNpiVerified(result.valid && !result.duplicate);
      setNpiMeta({
        providerName: result.providerName,
        providerType: result.providerType,
        duplicate: result.duplicate,
        error: result.error,
      });
    } catch {
      setNpiVerified(false);
      setNpiMeta({
        error: 'NPI verification is temporarily unavailable. Please try again.',
      });
    } finally {
      setNpiVerifying(false);
    }
  };

  // Real-time: auto-verify once the user finishes entering 10 digits.
  useEffect(() => {
    if (!requiresNpi || npiDigits.length !== 10) return;
    const t = setTimeout(() => {
      void runNpiVerify(npiDigits);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when digits/role change
  }, [npiDigits, requiresNpi]);

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
    return <Navigate to={returnTo ?? PLATFORM_HOME} replace />;
  }

  const handleOAuth = async (provider: 'google') => {
    if (!googleOAuthEnabled) {
      setError(googleOAuthMigrationMessage);
      return;
    }
    setError(null);
    setOauthLoading(provider);
    try {
      const oauthReturn = returnTo ?? PLATFORM_HOME;
      const url = cognitoAuthEnabled
        ? await buildCognitoAuthorizeUrl('Google', oauthReturn)
        : buildOAuthAuthorizeUrl(provider, oauthReturn);
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
      <div className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-background">
        <div className={cn(RAIL, 'py-16 md:py-24')}>
          <Card className="home-enter mx-auto max-w-[34rem] p-8 text-center sm:p-10">
            <p className="text-label uppercase text-muted-foreground">Almost there</p>
            <h2 className="mt-3 text-balance text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.25rem]">
              Check your email
            </h2>
            <p className="text-pretty mx-auto mt-4 max-w-[46ch] leading-relaxed text-muted-foreground">
              {cognitoAuthEnabled ? (
                <>
                  If this email can be registered, you&apos;ll receive a 6-digit verification code
                  from <strong className="font-medium text-foreground">noreply@communityhealth.media</strong>. Already have an
                  account?{' '}
                  <Link to="/login" className="rounded-[6px] font-medium text-brand-600 hover:text-brand-700">
                    Sign in
                  </Link>{' '}
                  or{' '}
                  <Link
                    to="/forgot-password"
                    className="rounded-[6px] font-medium text-brand-600 hover:text-brand-700"
                  >
                    reset your password
                  </Link>
                  .
                </>
              ) : (
                <>
                  If this email can be registered, you&apos;ll receive a verification link. Already
                  have an account?{' '}
                  <Link to="/login" className="rounded-[6px] font-medium text-brand-600 hover:text-brand-700">
                    Sign in
                  </Link>
                  .
                </>
              )}
            </p>
            {/* A styled Link rather than <Button to>, because this one has to
                carry router state through to the verification screen. */}
            <Link
              to={
                cognitoAuthEnabled
                  ? `/verify-email?email=${encodeURIComponent(email.trim())}`
                  : '/login'
              }
              state={fromLocation ? { from: fromLocation } : undefined}
              className="mt-8 inline-flex h-12 items-center justify-center rounded-[6px] bg-brand-600 px-7 text-base font-medium text-white shadow-card transition-[background-color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]"
            >
              {cognitoAuthEnabled ? 'Enter verification code' : 'Go to Login'}
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-background">
      {/* ── 01 / Join ─────────────────────────────────────────
          The pitch. Space, not a rule, separates it from the form. */}
      <section aria-labelledby="join-heading">
        <div className={cn(RAIL, 'py-16 md:py-24')}>
          <header className="home-enter">
            <p className="text-label uppercase text-muted-foreground">01 / Join</p>
            <h1
              id="join-heading"
              className="mt-3 text-balance text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem]"
            >
              Join CHT
            </h1>
            <p className="text-pretty mt-5 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
              CHT is a platform for healthcare professionals to participate in accredited education,
              surveys, and research opportunities, and to earn CME credits and honoraria.
            </p>
          </header>

          <ul className="mt-12 grid gap-4 sm:grid-cols-3" role="list">
            {VALUE_PROPS.map((v, i) => (
              <li key={v.title} className="home-enter" style={{ animationDelay: `${80 + i * 60}ms` }}>
                <ValueCard {...v} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 02 / Account ──────────────────────────────────────
          The task itself. Fields are the surfaces here: they sit on
          bg-card above the page, so nothing needs a border. */}
      <section aria-labelledby="account-heading" className="pb-24 md:pb-32">
        <div className={RAIL}>
          <SectionHead
            index="02 / Account"
            title="Create your account"
            sub="Join the Community Health platform."
            action={
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="rounded-[6px] font-medium text-brand-600 hover:text-brand-700"
                >
                  Sign in
                </Link>
              </p>
            }
          />

          <div className="mt-10 max-w-[42rem]">
            {googleOAuthEnabled ? (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthLoading}
                  className="w-full"
                >
                  {oauthLoading === 'google' ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-brand-600" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continue with Google
                </Button>
                <p className="text-center text-xs text-muted-foreground">{GOOGLE_OAUTH_DISCLAIMER}</p>
              </div>
            ) : (
              <p className="rounded-[6px] bg-warning/10 px-4 py-3 text-sm text-warning">
                {googleOAuthMigrationMessage}
              </p>
            )}

            {/* No rule across the page: the label alone carries the split. */}
            <p className="mt-8 text-label uppercase text-muted-foreground">
              Or create account with email
            </p>

            <form className="mt-5 space-y-10" onSubmit={handleSubmit} noValidate>
              {error && (
                <div role="alert" className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="First name"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
                <Field
                  label="Last name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
                <Field
                  className="sm:col-span-2"
                  label="Email address"
                  type="email"
                  placeholder="jane@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="sm:col-span-2">
                  <Field
                    label="Password"
                    type="password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-live="polite">
                    {SIGNUP_PASSWORD_RULES.map((rule) => {
                      const ok = passwordRules[rule.id];
                      return (
                        <li key={rule.id} className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              'grid size-4 shrink-0 place-items-center rounded-full transition-colors duration-150',
                              ok ? 'bg-success text-background' : 'bg-muted text-transparent',
                            )}
                            aria-hidden
                          >
                            <Check className="size-2.5" strokeWidth={3} />
                          </span>
                          <span className={ok ? 'text-success' : 'text-muted-foreground'}>
                            {rule.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                <SelectField
                  label="Role"
                  value={profession}
                  onChange={(e) => {
                    const v = e.target.value;
                    setProfession(v);
                    setNpiVerified(null);
                    setNpiMeta(null);
                    if (!professionRequiresNpi(v)) setNpiNumber('');
                  }}
                  options={JOIN_PROFESSION_OPTIONS}
                  required
                />
                {profession && !professionRequiresNpi(profession) ? (
                  <p className="max-w-[62ch] rounded-[6px] bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    <strong className="font-medium text-foreground">Note:</strong> NPI is not
                    required for your role. Honorarium programs are designed for licensed healthcare
                    professionals: you can still access all educational content and events.
                  </p>
                ) : null}

                {requiresNpi && (
                  <div>
                    <label htmlFor="npi-number" className="text-sm text-muted-foreground">
                      NPI number
                    </label>
                    <p className="mt-1 max-w-[54ch] text-sm text-muted-foreground">
                      Enter your 10-digit National Provider Identifier (NPI). Required for licensed
                      healthcare roles.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="npi-number"
                        type="text"
                        inputMode="numeric"
                        placeholder="10-digit NPI"
                        value={npiNumber}
                        onChange={(e) => {
                          setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10));
                          setNpiVerified(null);
                          setNpiMeta(null);
                        }}
                        required
                        maxLength={10}
                        aria-describedby="npi-help"
                        className={cn(CONTROL, 'min-w-0 flex-1')}
                      />
                      <Button
                        type="button"
                        size="lg"
                        disabled={npiDigits.length !== 10 || npiVerifying}
                        onClick={() => void runNpiVerify(npiDigits)}
                      >
                        {npiVerifying ? 'Verifying…' : 'Verify'}
                      </Button>
                    </div>
                    <p id="npi-help" className="sr-only">
                      NPI must be exactly 10 digits and verified against the NPI registry.
                    </p>
                    {npiVerified === true && !npiMeta?.duplicate && (
                      <p className="mt-2 text-sm font-medium text-success">
                        NPI verified
                        {npiMeta?.providerName ? ` — ${npiMeta.providerName}` : ''}
                        {npiMeta?.providerType ? ` (${npiMeta.providerType})` : ''}.
                      </p>
                    )}
                    {(npiVerified === false || npiMeta?.duplicate) && (
                      <p className="mt-2 text-sm font-medium text-destructive">
                        {npiMeta?.error ||
                          'NPI not found in the National Provider Identifier registry. Please check and try again.'}
                      </p>
                    )}
                    {npiVerifying && npiVerified === null ? (
                      <p className="mt-2 text-sm text-muted-foreground">Checking NPI registry…</p>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <p className="text-label uppercase text-muted-foreground">Practice location</p>
                <p className="mt-2 max-w-[54ch] text-sm text-muted-foreground">
                  Institution and city are optional. State and 5-digit ZIP are required.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <Field
                    className="sm:col-span-2"
                    label="Institution / Hospital (optional)"
                    placeholder="e.g., Mayo Clinic"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                  />
                  <SelectField
                    label="State"
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setCity('');
                    }}
                    options={US_STATE_SELECT_OPTIONS}
                    required
                  />
                  <Field
                    label="ZIP code"
                    placeholder="12345"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    maxLength={5}
                    required
                    inputMode="numeric"
                  />
                  <CityTypeahead
                    className="sm:col-span-2"
                    label="City"
                    value={city}
                    onChange={setCity}
                    stateCode={state || undefined}
                    optional
                  />
                </div>
              </div>

              <div>
                <Button type="submit" size="lg" disabled={!canSubmit} className="w-full">
                  {!signupEnabled
                    ? 'Account creation temporarily unavailable'
                    : submitting
                      ? 'Creating account...'
                      : 'Create account'}
                </Button>
                {!canSubmit && signupEnabled ? (
                  <p className="mt-3 text-center text-sm text-muted-foreground">
                    Complete required fields (including password rules, role
                    {requiresNpi ? ', NPI' : ''}, state, and ZIP) to continue.
                  </p>
                ) : null}
              </div>
            </form>

            <p className="mt-6 text-sm text-muted-foreground">
              By continuing, you agree to our{' '}
              <Link to="/privacy" className="rounded-[6px] underline hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>

            <RecaptchaNotice />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ── the pitch ────────────────────────────────────────────── */

const VALUE_PROPS = [
  {
    icon: <Award className="h-5 w-5" aria-hidden />,
    title: 'Earn CME credits',
    text: 'Participate in accredited educational programs.',
  },
  {
    icon: <DollarSign className="h-5 w-5" aria-hidden />,
    title: 'Honoraria',
    text: 'Receive payment for eligible activities.',
  },
  {
    icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
    title: 'On your schedule',
    text: 'Short videos and surveys when it works for you.',
  },
];

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card className="h-full">
      <div className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
        {icon}
      </div>
      <p className="mt-5 font-medium text-foreground">{title}</p>
      <p className="text-pretty mt-1.5 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </Card>
  );
}

/* ── controls ─────────────────────────────────────────────── */

/**
 * The select counterpart to <Field>: same label, same surface, same
 * elevation, so a row of mixed controls reads as one set.
 */
function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}) {
  const uid = useId();
  const id = `${uid}-select`;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        className={cn(CONTROL, 'mt-2')}
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
