import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AuthFormCard from './components/AuthFormCard';

export default function MfaSetup() {
  const { beginMfaSetup, verifyMfaSetup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    (user?.role === 'ADMIN' ? '/admin' : '/app/settings');

  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleStartSetup = async () => {
    setError(null);
    setLoadingSetup(true);
    const result = await beginMfaSetup();
    setLoadingSetup(false);

    if (result.error) {
      setError(result.error.message || 'Could not start MFA setup.');
      return;
    }
    setSecretCode(result.secretCode || null);
    setOtpauthUri(result.otpauthUri || null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError('Authentication code is required.');
      return;
    }

    setVerifying(true);
    const result = await verifyMfaSetup(code);
    setVerifying(false);
    if (result.error) {
      setError(result.error.message || 'MFA verification failed.');
      return;
    }
    setSuccess(true);
  };

  return (
    <AuthFormCard
      title="Set up MFA"
      subtitle="Secure your account with an authenticator app."
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="space-y-3">
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              MFA is now enabled for your account.
            </div>
            <button
              type="button"
              onClick={() => navigate(from, { replace: true })}
              className="w-full rounded-lg bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              Continue
            </button>
          </div>
        )}

        {!secretCode && !success && (
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={loadingSetup}
            className="w-full rounded-lg bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
          >
            {loadingSetup ? 'Preparing...' : 'Start MFA setup'}
          </button>
        )}

        {secretCode && !success && (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900">Step 1: Add to authenticator app</p>
              <p className="mt-2">Use this secret key:</p>
              <p className="mt-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{secretCode}</p>
              {otpauthUri && (
                <p className="mt-2 text-xs text-gray-600 break-all">
                  If your app supports OTP URI, paste this: {otpauthUri}
                </p>
              )}
            </div>

            <form className="space-y-3" onSubmit={handleVerify}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">
                  Step 2: Enter the 6-digit code from your app
                </label>
                <input
                  type="text"
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-lg bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
              >
                {verifying ? 'Verifying...' : 'Verify and enable MFA'}
              </button>
            </form>
          </>
        )}

        {!success && (
          <div className="pt-2 space-y-2">
            <p className="text-center text-sm text-gray-600">
              <Link to="/app/settings" className="font-medium text-gray-900 hover:underline">
                Back to Settings
              </Link>
            </p>
            <p className="text-center text-sm text-gray-600">
              <Link to="/login" className="font-medium text-gray-900 hover:underline">
                Back to Login
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthFormCard>
  );
}
