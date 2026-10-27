/**
 * Version of the Terms of Use & Privacy Policy users must accept.
 * Bump when either document changes materially; every user is re-prompted on next visit.
 * 2026-10-22: Beta Participant Terms added to the acceptance pop-up (beta period).
 */
export const CURRENT_TERMS_VERSION = '2026-10-22';

/**
 * Beta Participant Terms Agreement version (Last Updated October 22, 2026).
 * Required only while the beta-terms feature flag/env is on.
 */
export const CURRENT_BETA_TERMS_VERSION = '2026-10-22';

/** Error code returned with 403 when an API call is made before accepting the terms. */
export const TERMS_NOT_ACCEPTED_CODE = 'TERMS_NOT_ACCEPTED';

export function hasAcceptedCurrentTerms(
  user:
    | { termsAcceptedAt?: Date | null; termsVersion?: string | null }
    | null
    | undefined,
): boolean {
  return (
    Boolean(user?.termsAcceptedAt) &&
    user?.termsVersion === CURRENT_TERMS_VERSION
  );
}

export function hasAcceptedCurrentBetaTerms(
  user:
    | { betaTermsAcceptedAt?: Date | null; betaTermsVersion?: string | null }
    | null
    | undefined,
): boolean {
  return (
    Boolean(user?.betaTermsAcceptedAt) &&
    user?.betaTermsVersion === CURRENT_BETA_TERMS_VERSION
  );
}

/**
 * Whether the user may use authenticated areas: current ToS/Privacy, plus
 * beta terms when the beta gate is enabled.
 */
export function hasAcceptedRequiredConsent(
  user:
    | {
        termsAcceptedAt?: Date | null;
        termsVersion?: string | null;
        betaTermsAcceptedAt?: Date | null;
        betaTermsVersion?: string | null;
      }
    | null
    | undefined,
  betaTermsRequired: boolean,
): boolean {
  if (!hasAcceptedCurrentTerms(user)) return false;
  if (!betaTermsRequired) return true;
  return hasAcceptedCurrentBetaTerms(user);
}
