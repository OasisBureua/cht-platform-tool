import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, X } from 'lucide-react';
import { clearTermsDeclined, readTermsDeclined } from '../lib/terms-consent';

/** Explains why the user was signed out after declining the Terms of Service & Privacy Policy. */
export default function TermsDeclinedNotice() {
  const [visible, setVisible] = useState(readTermsDeclined);

  useEffect(() => {
    if (visible) clearTermsDeclined();
  }, [visible]);

  if (!visible) return null;

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-3 text-sm sm:px-6">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="flex-1">
          <strong>Access restricted.</strong> You were signed out because the Terms of Service and Privacy Policy were
          not accepted. Member areas require acceptance.{' '}
          <Link to="/login" className="font-semibold underline underline-offset-2">
            Log in
          </Link>{' '}
          again to review and accept them.
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="rounded-[6px] p-1 hover:bg-amber-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
