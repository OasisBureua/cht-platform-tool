import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

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
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-gray-900">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/10 bg-white shadow-xl">
          <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 px-6 py-8 text-center">
            <h1 className="text-xl font-semibold text-white md:text-2xl">Check your email</h1>
            <p className="mt-2 text-sm text-white/95">
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link.
            </p>
          </div>
          <div className="p-6">
            <Link
              to="/login"
              className="block w-full rounded-lg bg-pink-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-pink-600"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 bg-gray-900">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200/10 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-orange-500 via-rose-500 to-pink-500 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-white md:text-2xl">Forgot Password?</h1>
          <p className="mt-2 text-sm text-white/95">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <div className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Email address</label>
              <input
                type="email"
                placeholder="johndoe@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-pink-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-70"
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
