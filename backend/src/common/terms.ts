/**
 * Version of the Terms of Service & Privacy Policy users must accept.
 * Bump when either document changes materially; every user is re-prompted on next visit.
 */
export const CURRENT_TERMS_VERSION = '2026-09-29';

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
