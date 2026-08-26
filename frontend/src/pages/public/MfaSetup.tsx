import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../contexts/AuthContext';
import AuthFormCard from './components/AuthFormCard';

export default function MfaSetup() {
  const { beginMfaSetup, verifyMfaSetup, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ||
    (user?.role === 'ADMIN' ? '/admin' : '/app/home');

  const [secretCode, setSecretCode] = useState<string | null>(null);
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showManualKey, setShowManualKey] = useState(false);

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
    setShowManualKey(false);
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
          <div className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="space-y-3">
            <div className="rounded-[6px] bg-success/10 px-4 py-3 text-sm text-success">
              MFA is now enabled for your account.
            </div>
            <button
              type="button"
              onClick={() => navigate(from, { replace: true })}
              className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
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
            className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
          >
            {loadingSetup ? 'Preparing...' : 'Start MFA setup'}
          </button>
        )}

        {secretCode && !success && (
          <>
            <div className="rounded-[6px] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Step 1: Scan with your authenticator app</p>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
                <li>Open an authenticator app on your phone.</li>
                <li>Choose add account / scan QR code.</li>
                <li>Point your camera at the QR code below.</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Works with apps such as{' '}
                <span className="font-medium text-foreground">Google Authenticator</span>,{' '}
                <span className="font-medium text-foreground">Microsoft Authenticator</span>,{' '}
                <span className="font-medium text-foreground">Authy</span>,{' '}
                <span className="font-medium text-foreground">1Password</span>, or{' '}
                <span className="font-medium text-foreground">Apple Passwords</span>.
              </p>
              {otpauthUri ? (
                <div className="mt-4 flex justify-center rounded-[6px] bg-card p-4">
                  <QRCodeSVG
                    value={otpauthUri}
                    size={180}
                    level="M"
                    marginSize={1}
                    title="MFA setup QR code"
                  />
                </div>
              ) : null}

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowManualKey((v) => !v)}
                  className="text-xs font-medium text-foreground underline hover:no-underline"
                >
                  {showManualKey ? 'Hide manual key' : 'Can’t scan? Enter key manually'}
                </button>
                {showManualKey && (
                  <p className="mt-2 break-all rounded bg-card px-2 py-1.5 font-mono text-xs text-foreground">
                    {secretCode}
                  </p>
                )}
              </div>
            </div>

            <form className="space-y-3" onSubmit={handleVerify}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
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
                  className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground placeholder-gray-400 focus:border-foreground focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-[6px] bg-[#000000] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-70"
              >
                {verifying ? 'Verifying...' : 'Verify and enable MFA'}
              </button>
            </form>
          </>
        )}

        {!success && (
          <div className="pt-2 space-y-2">
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/app/settings" className="font-medium text-foreground hover:underline">
                Back to Settings
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-foreground hover:underline">
                Back to Login
              </Link>
            </p>
          </div>
        )}
      </div>
    </AuthFormCard>
  );
}
