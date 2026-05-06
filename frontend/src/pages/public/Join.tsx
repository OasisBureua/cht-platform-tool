import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Award, DollarSign, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { buildOAuthAuthorizeUrl } from '../../lib/supabase-oauth';

const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your role' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
  { value: 'Industry', label: 'Industry / Non-Clinical' },
  { value: 'Researcher', label: 'Researcher / Scientist' },
  { value: 'Patient Advocate', label: 'Patient / Patient Advocate' },
  { value: 'Caregiver', label: 'Caregiver' },
  { value: 'Student', label: 'Student' },
  { value: 'Other', label: 'Other' },
];

const NPI_REQUIRED_PROFESSIONS = new Set([
  'Physician', 'Nurse Practitioner', 'Physician Assistant', 'Pharmacist', 'Nurse', 'Other HCP',
]);

const NON_HCP_PROFESSIONS = new Set([
  'Industry', 'Pharmaceuticals', 'Researcher', 'Patient Advocate', 'Caregiver', 'Student', 'Other',
]);

const US_STATES = [
  { value: '', label: 'Select state' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' }, { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const PLATFORM_HOME = '/app/home';

export default function Join() {
  const { isAuthenticated, signUp } = useAuth();
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

  const requiresNpi = NPI_REQUIRED_PROFESSIONS.has(profession);

  if (isAuthenticated) {
    return <Navigate to={PLATFORM_HOME} replace />;
  }

  const handleOAuth = (provider: 'google' | 'apple') => {
    setError(null);
    setOauthLoading(provider);
    // Use direct authorize URL with redirect_to - fixes Google OAuth redirect (Sebastien)
    window.location.href = buildOAuthAuthorizeUrl(provider, PLATFORM_HOME);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (!lastName.trim()) { setError('Last name is required.'); return; }
    if (!email.trim()) { setError('Email address is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!profession) { setError('Please select your role.'); return; }
    const npi = npiNumber.replace(/\D/g, '');
    if (requiresNpi && npi.length !== 10) {
      setError('NPI number must be exactly 10 digits.');
      return;
    }
    if (requiresNpi && npiVerified === false) {
      setError('We could not verify this NPI. Please double-check and try again.');
      return;
    }
    const zip = zipCode.replace(/\D/g, '');
    if (zip && zip.length !== 0 && zip.length !== 5 && zip.length !== 9) {
      setError('ZIP code must be 5 digits (or 9 for ZIP+4).');
      return;
    }

    setSubmitting(true);
    const { error: err } = await signUp(email, password, {
      firstName,
      lastName,
      profession,
      npiNumber: requiresNpi ? (npi || undefined) : undefined,
      institution: institution.trim() || undefined,
      city: city.trim() || undefined,
      state: state || undefined,
      zipCode: zipCode.trim() || undefined,
    });
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
        <div className="w-full max-w-md rounded-2xl border border-gray-200/90 bg-white/95 p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_20px_50px_-24px_rgba(0,0,0,0.12)]">
          <h2 className="text-balance text-xl font-semibold text-gray-900">Check your email</h2>
          <p className="text-pretty mt-2 text-sm text-gray-600">
            We&apos;ve sent a verification link to <strong>{email}</strong>. Click the link to verify your account, then you can sign in.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] transition-[background-color,transform] duration-200 ease-out hover:bg-black active:scale-[0.96]"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-gray-50/90 via-white to-white px-4 py-10 sm:px-6 sm:py-12 md:py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-14">
        {/* Mobile: form first (order-1). Desktop: story left, form right — equal 1fr columns */}
        <aside className="order-2 space-y-5 lg:sticky lg:top-24 lg:order-1">
          <header className="text-center lg:text-left">
            <p className="text-sm font-semibold tracking-wide text-brand-700">Join</p>
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
          <h2 className="text-balance text-lg font-semibold tracking-tight text-gray-900 sm:text-xl">Create your account</h2>

          <p className="text-pretty mt-1 text-sm leading-snug text-gray-600">
            Join the Community Health platform.
          </p>

          {/* OAuth sign-up creates CHT account and redirects to platform */}
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuth('google')}
                disabled={!!oauthLoading}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_6px_16px_-8px_rgba(0,0,0,0.08)] transition-[background-color,transform,box-shadow,color] duration-200 ease-out hover:bg-gray-50/90 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
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
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-gray-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-gray-800 shadow-[0_1px_0_0_rgba(255,255,255,0.9)_inset,0_6px_16px_-8px_rgba(0,0,0,0.08)] transition-[background-color,transform,box-shadow,color] duration-200 ease-out hover:bg-gray-50/90 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
              >
                {oauthLoading === 'apple' ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                ) : (
                  <AppleIcon />
                )}
                Apple
              </button>
            </div>
            <p className="text-center text-xs text-gray-500">Sign up with Google or Apple</p>
          </div>

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

          <form className="mt-4" onSubmit={handleSubmit}>
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
              <div className="min-w-0">
                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="min-w-0 sm:col-span-2">
                <Select
                  label="I am a…"
                  value={profession}
                  onChange={(e) => { setProfession(e.target.value); setNpiVerified(null); }}
                  options={PROFESSION_OPTIONS}
                  required
                />
                {profession && NON_HCP_PROFESSIONS.has(profession) && (
                  <p className="mt-1.5 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <strong>Note:</strong> NPI is not required for your role. Honorarium programs are designed for licensed healthcare professionals — you can still access all educational content and events.
                  </p>
                )}
              </div>
              {requiresNpi && (
                <div className="min-w-0 space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-semibold text-gray-900">NPI number</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="10-digit NPI"
                      value={npiNumber}
                      onChange={(e) => { setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10)); setNpiVerified(null); }}
                      required
                      maxLength={10}
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <button
                      type="button"
                      disabled={npiNumber.replace(/\D/g, '').length !== 10 || npiVerifying}
                      onClick={async () => {
                        setNpiVerifying(true);
                        setNpiVerified(null);
                        try {
                          const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npiNumber.replace(/\D/g, '')}&version=2.1`);
                          const data = await res.json();
                          setNpiVerified(data.result_count > 0);
                        } catch {
                          setNpiVerified(null);
                        } finally {
                          setNpiVerifying(false);
                        }
                      }}
                      className="shrink-0 rounded-xl bg-gray-900 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset] transition-[background-color,transform,opacity] duration-200 ease-out hover:bg-black active:scale-[0.96] disabled:opacity-50"
                    >
                      {npiVerifying ? 'Verifying…' : 'Verify'}
                    </button>
                  </div>
                  {npiVerified === true && (
                    <p className="text-xs font-medium text-green-700">NPI verified successfully.</p>
                  )}
                  {npiVerified === false && (
                    <p className="text-xs font-medium text-red-600">NPI not found in the NPPES registry. Please check and try again.</p>
                  )}
                </div>
              )}

              <div className="border-t border-gray-100/90 pt-3 shadow-[0_-1px_0_0_rgba(255,255,255,0.85)] sm:col-span-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Practice Location <span className="font-normal normal-case">(optional)</span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-3">
                  <div className="min-w-0 sm:col-span-2">
                    <Input
                      label="Institution / Hospital"
                      placeholder="e.g., Mayo Clinic"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                    />
                  </div>
                  <div className="min-w-0">
                    <Input
                      label="City"
                      placeholder="e.g., Rochester"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div className="min-w-0">
                    <Select
                      label="State"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      options={US_STATES}
                    />
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <Input
                      label="ZIP code"
                      placeholder="12345"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset,0_12px_32px_-12px_rgba(0,0,0,0.35)] transition-[background-color,transform,box-shadow,opacity] duration-200 ease-out hover:bg-black active:scale-[0.96] disabled:pointer-events-none disabled:opacity-70"
                >
                  {submitting ? 'Creating account...' : 'Create account'}
                </button>
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
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] placeholder:text-gray-400 transition-[border-color,box-shadow] duration-200 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-[0_1px_0_0_rgba(255,255,255,0.85)_inset] transition-[border-color,box-shadow] duration-200 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
