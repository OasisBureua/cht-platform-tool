import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthFormCard from './components/AuthFormCard';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = location.state as
    | { email?: string; from?: { pathname: string; search?: string } }
    | null;
  const initialEmail =
    stateData?.email ||
    new URLSearchParams(location.search).get('email') ||
    '';
  const fromLocation = stateData?.from;
  const { confirmEmailSignup, resendEmailVerificationCode } = useAuth();

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!code.trim()) {
      setError('Verification code is required.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await confirmEmailSignup(email, code);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Verification failed. Please try again.');
      return;
    }
    navigate('/login', {
      replace: true,
      state: {
        email: email.trim(),
        verified: true,
        ...(fromLocation && { from: fromLocation }),
      },
    });
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setResending(true);
    const { error: err } = await resendEmailVerificationCode(email);
    setResending(false);
    if (err) {
      setError(err.message || 'Could not resend verification code.');
      return;
    }
    setInfo('A new verification code was sent. Check your inbox and spam folder.');
  };

  return (
    <AuthFormCard
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent from noreply@communityhealth.media."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-[6px] bg-red-50 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-[6px] bg-green-50 px-4 py-3 text-sm text-green-800">
            {info}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Verification code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 disabled:opacity-70"
        >
          {submitting ? 'Verifying...' : 'Verify email'}
        </button>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending}
        className="mt-3 w-full rounded-[6px] border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {resending ? 'Sending...' : 'Resend verification code'}
      </button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Already verified?{' '}
        <Link to="/login" className="font-medium text-foreground underline hover:text-muted-foreground">
          Sign in
        </Link>
      </p>
    </AuthFormCard>
  );
}

function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const id = props.id || props.name || label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="w-full rounded-[6px] border border-border px-3 py-2 text-sm text-foreground shadow-card focus:border-foreground focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}
