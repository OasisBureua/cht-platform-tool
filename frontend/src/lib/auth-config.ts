/** Shared auth feature flags from Vite env. */
export const cognitoAuthEnabled =
  !!import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() &&
  !!import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() &&
  !!import.meta.env.VITE_COGNITO_DOMAIN?.trim();

/** Shown on login/join when Google IdP is not wired up yet. */
export const googleOAuthMigrationMessage =
  'Google sign-up and sign-in are temporarily unavailable while auth migration is in progress.';

/**
 * Google OAuth via Cognito Hosted UI.
 * Set VITE_GOOGLE_OAUTH_ENABLED=true when Cognito Google IdP is configured.
 */
export const googleOAuthEnabled =
  cognitoAuthEnabled && import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true';

/** reCAPTCHA v3 on email/password login and join when site key is set. */
export const recaptchaEnabled = !!import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
