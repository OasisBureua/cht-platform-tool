import { showAuthMigrationNotice } from '../../lib/auth-migration-notice';

type Variant = 'login' | 'forgot' | 'reset';

const COPY: Record<Variant, string> = {
  login:
    'We upgraded sign-in. Your previous platform password will not work. Use Continue with Google, or Forgot password once to set a new password.',
  forgot:
    'We send a 6-digit code to your email (not a link). Enter it on the next screen to set a new password. Your old platform password cannot be reused.',
  reset:
    'Use at least 8 characters with uppercase, lowercase, and a number. After this, you can sign in with email and password or Continue with Google.',
};

export function AuthMigrationNotice({ variant }: { variant: Variant }) {
  if (!showAuthMigrationNotice()) return null;

  return (
    <div
      role="status"
      className="rounded-[6px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950"
    >
      {COPY[variant]}
    </div>
  );
}
