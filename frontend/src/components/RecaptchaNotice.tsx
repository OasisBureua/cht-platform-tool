import { recaptchaEnabled } from '../lib/auth-config';

export function RecaptchaNotice() {
  if (!recaptchaEnabled) {
    return null;
  }

  return (
    <p className="mt-4 text-center text-xs text-gray-500">
      This site is protected by reCAPTCHA and the Google{' '}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Privacy Policy
      </a>{' '}
      and{' '}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Terms of Service
      </a>{' '}
      apply.
    </p>
  );
}
