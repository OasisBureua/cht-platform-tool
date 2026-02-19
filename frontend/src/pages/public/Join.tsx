import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Award, DollarSign, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
];

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

  if (isAuthenticated) {
    return <Navigate to="/app/home" replace />;
  }

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
      <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 md:py-16">
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
    <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 md:py-16">
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
