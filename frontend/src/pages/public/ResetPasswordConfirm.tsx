import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthFormCard from './components/AuthFormCard';
import { AuthMigrationNotice } from '../../components/auth/AuthMigrationNotice';

export default function ResetPasswordConfirm() {
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!code.trim()) {
      setError('Reset code is required.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const { error: err } = await confirmPasswordReset(email, code, password);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Could not reset password. Please try again.');
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <AuthFormCard
        title="Password updated"
        subtitle="Your password has been reset successfully."
      >
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="block w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-900"
        >
          Continue to Login
        </button>
        <Link
          to="/forgot-password"
          className="mt-3 block w-full rounded-[6px] border border-border px-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Send another reset code
        </Link>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard
      title="Reset your password"
      subtitle="Enter the reset code from your email and choose a new password."
    >
      <div className="mb-4">
        <AuthMigrationNotice variant="reset" />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-[6px] bg-red-50 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Field
          label="Email address"
          type="email"
          placeholder="johndoe@gmail.com"
          value={email}
          onChange={setEmail}
        />
        <Field
          label="Reset code"
          placeholder="123456"
          value={code}
          onChange={setCode}
        />
        <Field
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={setPassword}
        />
        <Field
          label="Confirm new password"
          type="password"
          placeholder="Repeat your new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
        >
          {submitting ? 'Updating...' : 'Reset password'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/forgot-password" className="font-medium text-foreground hover:underline">
          Back to Forgot Password
        </Link>
      </p>
    </AuthFormCard>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  );
}
