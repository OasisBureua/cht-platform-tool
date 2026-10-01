import { SetMetadata } from '@nestjs/common';

export const SKIP_TERMS_CHECK = 'skipTermsCheck';

/**
 * Allows a JwtAuthGuard route before the user accepts the current Terms of Service.
 * Reserve for onboarding and session endpoints (auth, profile completion).
 */
export const SkipTermsCheck = () => SetMetadata(SKIP_TERMS_CHECK, true);
