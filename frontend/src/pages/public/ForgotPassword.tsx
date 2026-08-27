import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthFormCard from './components/AuthFormCard';
import { AuthMigrationNotice } from '../../components/auth/AuthMigrationNotice';

export default function ForgotPassword() {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err } = await resetPasswordForEmail(email);
    setSubmitting(false);
    if (err) {
      setError(err.message || 'Failed to send reset link. Please try again.');
      return;
    }
    setSuccess(true);
  };

  if (success) {
    return (
      <AuthFormCard
        title="Check your email"
        subtitle={
          <>
            If an account exists for <strong>{email}</strong>, you&apos;ll receive a 6-digit reset code by email.
          </>
        }
      >
        <Link
          to="/reset-password/confirm"
          className="block w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-700"
        >
          Enter reset code
        </Link>
        <Link
          to="/login"
          className="mt-3 block w-full rounded-[6px] border border-border px-4 py-2.5 text-center text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          Back to Login
        </Link>
      </AuthFormCard>
    );
  }

  return (
      <AuthFormCard
        title="Forgot Password?"
        subtitle="Enter your email and we'll send you a 6-digit reset code."
      >
        <div className="mb-4">
          <AuthMigrationNotice variant="forgot" />
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Email address</label>
          <input
            type="email"
            placeholder="johndoe@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
        >
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
          Back to Login
        </Link>
      </p>
    </AuthFormCard>
  );
}
