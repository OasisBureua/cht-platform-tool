/**
 * Soft AppConfig `/mfa/setup` enrollment and Cognito login MFA are mutually
 * exclusive for a given sign-in. Soft prompt only when password auth returned
 * a session and AppConfig says enrollment is still required — never after a
 * Cognito MFA challenge or MFA_SETUP response.
 */
export function shouldPromptSoftMfaEnrollment(options: {
  mfaEnrollmentRequired?: boolean;
  /** True when Cognito returned SOFTWARE_TOKEN_MFA, SMS_MFA, or MFA_SETUP. */
  cognitoMfa?: boolean;
}): boolean {
  return Boolean(options.mfaEnrollmentRequired) && !options.cognitoMfa;
}
