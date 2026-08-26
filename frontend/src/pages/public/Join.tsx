import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
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
import { ChmMark } from '../../components/brand/ChmMark';
import { verifyNpiNumber } from '../../api/npi';
import { catalogApi } from '../../api/catalog';
import {
  getMediaHubThumbnail,
  hasRealThumbnail,
  shouldSurfaceCatalogClip,
} from '../../utils/clipUrl';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import { Button, Field } from '../../components/ui';
import { cn } from '../../lib/cn';

const JOIN_PROFESSION_OPTIONS = signupProfessionSelectOptions().map((o, i) =>
  i === 0 ? { ...o, label: 'Select your role' } : { ...o },
);

const PLATFORM_HOME = '/app/home';

/**
 * One control treatment across the form: a surface with elevation, no
 * hairline. Matches <Field> and <CityTypeahead> so a row of mixed
 * controls reads as one set.
 */
const CONTROL =
  'h-12 w-full rounded-[6px] bg-surface px-4 text-base text-text shadow-[var(--shadow-card)] ' +
  'outline-none placeholder:text-placeholder sm:text-body-m ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor';

/** The glass card on the panel: surface at 88%, popped and blurred. */
const FROST =
  'rounded-[10px] bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] p-4 ' +
  'shadow-[var(--shadow-pop)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)] ' +
  'backdrop-blur-2xl backdrop-saturate-150';

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

  /* ── sent ───────────────────────────────────────────────────────────
     The same shell, with the confirmation standing in for the form. */
  if (success) {
    return (
      <AuthShell
        heading="Check your email"
        sub="Nothing else to do here. The next step is in your inbox."
        footer={{ prompt: 'Already have an account?', label: 'Log in', href: '/login' }}
      >
        <p role="status" className="card mt-8 p-5 text-body-m text-dim">
          {cognitoAuthEnabled ? (
            <>
              If this email can be registered, you&apos;ll receive a 6-digit verification code
              from <strong className="font-medium text-text">noreply@communityhealth.media</strong>.
              You can also{' '}
              <Link
                to="/forgot-password"
                className="press rounded-[6px] text-anchor hover:brightness-110"
              >
                reset your password
              </Link>{' '}
              if you have been here before.
            </>
          ) : (
            <>
              If this email can be registered, you&apos;ll receive a verification link.
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
          className="press mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-inverse text-body-m font-medium text-ground hover:brightness-[0.92]"
        >
          {cognitoAuthEnabled ? 'Enter verification code' : 'Go to Login'}
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      heading="Free for clinicians"
      sub="Every session, every format, one email a week. It stays free."
      footer={{ prompt: 'Already have an account?', label: 'Log in', href: '/login' }}
    >
      {googleOAuthEnabled ? (
        <div className="mt-8 space-y-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            className="w-full"
          >
            {oauthLoading === 'google' ? (
              <span className="size-4 animate-spin rounded-full border-2 border-hairline border-t-anchor" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>
          <p className="text-center text-body-s text-faint">{GOOGLE_OAUTH_DISCLAIMER}</p>
        </div>
      ) : (
        <p className="mt-8 rounded-[6px] bg-amber-ink/10 px-4 py-3 text-body-s text-amber-ink">
          {googleOAuthMigrationMessage}
        </p>
      )}

      {/* No rule across the column: the label alone carries the split. */}
      <p className="eyebrow mt-8 text-faint">Or with email</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-[6px] bg-destructive/10 px-4 py-3 text-body-s text-destructive"
          >
            {error}
          </p>
        )}

        <fieldset className="space-y-5">
          <legend className="sr-only">Create a CHM account</legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="First name"
              placeholder="Jane"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
            <Field
              label="Last name"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </div>

          <Field
            label="Work email"
            type="email"
            inputMode="email"
            placeholder="name@hospital.org"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <div>
            <Field
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-live="polite">
              {SIGNUP_PASSWORD_RULES.map((rule) => {
                const ok = passwordRules[rule.id];
                return (
                  <li key={rule.id} className="flex items-center gap-2 text-meta">
                    <span
                      className={cn(
                        'grid size-4 shrink-0 place-items-center rounded-full',
                        'transition-colors duration-150 ease-[var(--ease-standard)]',
                        ok ? 'bg-success text-ground' : 'bg-surface-2 text-transparent',
                      )}
                      aria-hidden
                    >
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                    <span className={ok ? 'text-success' : 'text-faint'}>{rule.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

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
            <p className="rounded-[6px] bg-surface px-4 py-3 text-body-s text-muted2">
              <strong className="font-medium text-text">Note:</strong> NPI is not required for
              your role. Honorarium programs are designed for licensed healthcare professionals:
              you can still access all educational content and events.
            </p>
          ) : null}

          {requiresNpi && (
            <div>
              <label htmlFor="npi-number" className="text-body-s text-dim">
                NPI number
              </label>
              <p className="mt-1 text-body-s text-faint">
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
                  variant="outline"
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
                <p className="mt-2 text-body-s font-medium text-success">
                  NPI verified
                  {npiMeta?.providerName ? ` — ${npiMeta.providerName}` : ''}
                  {npiMeta?.providerType ? ` (${npiMeta.providerType})` : ''}.
                </p>
              )}
              {(npiVerified === false || npiMeta?.duplicate) && (
                <p className="mt-2 text-body-s font-medium text-destructive">
                  {npiMeta?.error ||
                    'NPI not found in the National Provider Identifier registry. Please check and try again.'}
                </p>
              )}
              {npiVerifying && npiVerified === null ? (
                <p className="mt-2 text-body-s text-faint">Checking NPI registry…</p>
              ) : null}
            </div>
          )}

          <div>
            <p className="eyebrow text-faint">Practice location</p>
            <p className="mt-2 text-body-s text-faint">
              Institution and city are optional. State and 5-digit ZIP are required.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field
                className="sm:col-span-2"
                label="Institution / Hospital (optional)"
                placeholder="e.g., Mayo Clinic"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                autoComplete="organization"
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
                inputMode="numeric"
                autoComplete="postal-code"
                required
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
        </fieldset>

        <Button
          type="submit"
          size="lg"
          disabled={!canSubmit}
          className="mt-7 w-full bg-inverse text-ground shadow-none hover:bg-inverse hover:brightness-[0.92]"
        >
          {!signupEnabled
            ? 'Account creation temporarily unavailable'
            : submitting
              ? 'Creating account…'
              : 'Create account'}
          <ArrowRight className="size-4" strokeWidth={1.75} />
        </Button>

        {!canSubmit && signupEnabled ? (
          <p className="mt-3 text-center text-body-s text-faint">
            Complete required fields (including password rules, role
            {requiresNpi ? ', NPI' : ''}, state, and ZIP) to continue.
          </p>
        ) : null}
      </form>

      <p className="mt-6 text-body-s text-faint">
        By continuing, you agree to our{' '}
        <Link to="/privacy" className="press rounded-[6px] text-anchor hover:brightness-110">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="mt-6 text-center text-body-s text-faint">
        Working in industry instead?{' '}
        <Link to="/what-we-do" className="press rounded-[6px] text-anchor hover:brightness-110">
          See how CHM partners with pharma
        </Link>
      </p>

      <RecaptchaNotice />
    </AuthShell>
  );
}

/* ── shell ────────────────────────────────────────────────────────── */

/**
 * Two panels: the form on one side, the thing you are signing up for on
 * the other. Below lg the panel drops away and the form takes the
 * screen on its own.
 *
 * The registration form is far taller than a viewport, so at lg the
 * shell is pinned to one screen and the form column scrolls inside it.
 * `position: sticky` cannot do the job here: PublicLayout's <main>
 * carries overflow-x-hidden, which makes it a scroll container and
 * leaves a sticky descendant stranded.
 *
 * The floating card shows a real session rather than a testimonial,
 * because a quote from a clinician who did not say it is a fabricated
 * endorsement, and the session is the more honest argument anyway.
 */
function AuthShell({
  heading,
  sub,
  children,
  footer,
}: {
  heading: string;
  sub: string;
  children: ReactNode;
  footer: { prompt: string; label: string; href: string };
}) {
  return (
    <div className="bg-ground lg:grid lg:h-[calc(100dvh-4rem)] lg:grid-cols-2 lg:overflow-hidden">
      {/* ── form ─────────────────────────────────────────── */}
      <div className="flex flex-col px-5 py-10 sm:px-10 lg:min-h-0 lg:overflow-y-auto lg:py-8 lg:px-12 xl:px-16">
        {/* `my-auto` rather than justify-center: a centred flex child in
            a scroll container puts its own overflow out of reach. */}
        <div className="mx-auto my-auto w-full max-w-[25rem]">
          <Link to="/home" aria-label="CHM home" className="press -ms-2 block w-fit rounded-[6px] p-2">
            <ChmMark className="size-7 text-anchor" />
          </Link>

          <Link
            to="/home"
            className="press mt-5 inline-flex w-fit items-center gap-1.5 rounded-[6px] py-1 text-body-s text-muted2 hover:text-text"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back
          </Link>

          <h1 className="display display-tight mt-4 text-[1.875rem] leading-[1.08] text-text">
            {heading}
          </h1>
          <p className="prose-lede mt-3 text-body-m text-muted2">{sub}</p>

          {children}

          <p className="mt-8 text-body-s text-muted2">
            {footer.prompt}{' '}
            <Link to={footer.href} className="press rounded-[6px] text-anchor hover:brightness-110">
              {footer.label}
            </Link>
          </p>
        </div>
      </div>

      {/* ── panel ────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-surface lg:block">
        <img src="/img/cells-warm.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(150deg, color-mix(in oklab, var(--color-blue-deep) 62%, transparent) 0%, color-mix(in oklab, var(--color-blue) 28%, transparent) 46%, color-mix(in oklab, var(--color-pink) 30%, transparent) 100%)',
          }}
        />

        <div className="absolute inset-x-10 bottom-12 xl:inset-x-14">
          <LatestSession />
        </div>
      </div>
    </div>
  );
}

/* ── the panel's proof ────────────────────────────────────────────── */

/**
 * The newest thing on the platform, pulled from the live catalog rather
 * than hard-coded, so the argument for signing up is never stale.
 */
function LatestSession() {
  const { data, isPending } = useQuery({
    queryKey: ['catalog', 'clips', 'join-latest'],
    queryFn: () => catalogApi.getClips({ sort_by: 'posted', limit: 6 }),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const featured = (data?.items ?? []).find(
    (clip) => shouldSurfaceCatalogClip(clip) && hasRealThumbnail(clip),
  );

  if (!featured) {
    // Never leave a hollow card sitting on the panel: the placeholder
    // exists only while the request is in flight.
    if (!isPending) return null;
    return (
      <div className={FROST} aria-hidden>
        <div className="h-3 w-24 rounded-[3px] bg-surface-2" />
        <div className="mt-3 flex items-center gap-3">
          <div className="h-16 w-28 shrink-0 rounded-[6px] bg-surface-2" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-full rounded-[3px] bg-surface-2" />
            <div className="h-3.5 w-2/3 rounded-[3px] bg-surface-2" />
          </div>
        </div>
      </div>
    );
  }

  const lead = featured.doctors?.[0] ? doctorLabelFromSlug(featured.doctors[0]) : null;
  const meta = [lead, formatDuration(featured.duration_seconds)].filter(Boolean).join(' · ');

  return (
    <div className={FROST}>
      <p className="eyebrow text-faint">Latest on CHM</p>
      <div className="mt-3 flex items-center gap-3">
        <span className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-[6px] bg-ground">
          <img
            src={getMediaHubThumbnail(featured)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        </span>
        <span className="min-w-0">
          <span className="display line-clamp-2 block text-body-m text-text">
            {featured.title}
          </span>
          {meta ? <span className="meta mt-1 block text-faint">{meta}</span> : null}
        </span>
      </div>
    </div>
  );
}

/** Sessions are read in minutes; anything under one reads in seconds. */
function formatDuration(seconds: number | undefined): string | null {
  if (!seconds || seconds < 0) return null;
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  return `${Math.round(seconds / 60)} min`;
}

/* ── controls ─────────────────────────────────────────────────────── */

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
      <label htmlFor={id} className="block text-body-s text-dim">
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
