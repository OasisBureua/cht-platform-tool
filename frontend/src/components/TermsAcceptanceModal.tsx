import { useId, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck, X } from 'lucide-react';
import { Button } from './ui';
import { useAuth } from '../contexts/AuthContext';
import { termsApi } from '../api/terms';
import { getApiErrorMessage } from '../api/client';
import { markTermsDeclined } from '../lib/terms-consent';

/**
 * Blocking consent step shown before any authenticated area renders.
 * Closing counts as declining: the session ends and the user returns to the landing page.
 */
export default function TermsAcceptanceModal() {
  const { user, refreshProfile, logout } = useAuth();
  const titleId = useId();
  const bodyId = useId();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const version = user?.termsVersion ?? '';

  const handleAccept = async () => {
    if (!agreed || busy) return;
    setBusy('accept');
    setError(null);
    try {
      await termsApi.accept(version);
      await refreshProfile();
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not save your acceptance. Please try again.'));
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    if (busy) return;
    setBusy('decline');
    markTermsDeclined();
    try {
      await termsApi.decline();
    } catch {
      /* logout below still ends the session */
    }
    logout();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-card bg-card shadow-card-hover"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-600/10 text-brand-600">
                <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 id={titleId} className="text-lg font-semibold text-foreground">
                Terms of Service &amp; Privacy Policy Confirmation
              </h2>
            </div>
            <button
              type="button"
              onClick={handleDecline}
              disabled={busy !== null}
              className="rounded-[6px] p-2 text-muted-foreground hover:bg-muted disabled:opacity-50"
              aria-label="Close and sign out"
            >
              <X className="size-5" />
            </button>
          </div>

          <div id={bodyId} className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              Welcome to Community Health Media. Before you continue, please review our updated Terms and Conditions
              and Privacy Policy. Using the site requires that you accept them.
            </p>
            <p>
              They explain how you may use the platform, how we collect and protect your information, and your rights
              as a member.
            </p>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-[6px] bg-muted px-4 py-3 text-sm font-medium text-foreground hover:brightness-95"
            >
              Terms and Conditions
              <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-[6px] bg-muted px-4 py-3 text-sm font-medium text-foreground hover:brightness-95"
            >
              Privacy Policy
              <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[6px] border border-border p-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={busy !== null}
              autoFocus
              className="mt-0.5 size-4 shrink-0 accent-brand-600"
            />
            <span className="text-sm text-foreground">
              I have read and agree to the Terms and Conditions and the Privacy Policy.
            </span>
          </label>

          {error ? (
            <div role="alert" className="mt-4 rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleDecline} disabled={busy !== null}>
              {busy === 'decline' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Decline and sign out
            </Button>
            <Button onClick={handleAccept} disabled={!agreed || busy !== null}>
              {busy === 'accept' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Accept and continue
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            If you decline, you will be signed out and won't be able to use member areas until you accept.
          </p>
        </div>
      </div>
    </div>
  );
}
