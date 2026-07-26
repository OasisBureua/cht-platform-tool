/** Shared auth feature flags from Vite env. */
export const cognitoAuthEnabled =
  !!import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim() &&
  !!import.meta.env.VITE_COGNITO_CLIENT_ID?.trim() &&
  !!import.meta.env.VITE_COGNITO_DOMAIN?.trim();

export const mediahubAuthDecommissioned =
  import.meta.env.VITE_MEDIAHUB_AUTH_DECOMMISSIONED !== 'false';

/** Shown on login/join when Google IdP is not wired up yet. */
export const googleOAuthMigrationMessage =
  'Google sign-up and sign-in are temporarily unavailable while auth migration is in progress.';

/**
 * Google OAuth: legacy GoTrue only until Cognito Google IdP is configured.
 * Set VITE_GOOGLE_OAUTH_ENABLED=true after migration when ready.
 */
export const googleOAuthEnabled = cognitoAuthEnabled
  ? import.meta.env.VITE_GOOGLE_OAUTH_ENABLED === 'true'
  : !mediahubAuthDecommissioned;

/** reCAPTCHA v3 on email/password login and join when site key is set. */
export const recaptchaEnabled = !!import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();
