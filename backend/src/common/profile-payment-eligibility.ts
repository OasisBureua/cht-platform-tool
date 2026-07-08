import { BadRequestException } from '@nestjs/common';

export type ProfilePaymentFields = {
  specialty: string | null;
  npiNumber: string | null;
};

/**
 * Specialties that are non-clinical / non-HCP and therefore do not require an NPI.
 * 'Pharmaceuticals' is kept for backward-compat with existing DB records; display label
 * was renamed to 'Industry' in the frontend.
 */
export const NON_HCP_SPECIALTIES = new Set([
  'Industry',
  'Pharmaceuticals',
  'Researcher',
  'Patient Advocate',
  'Caregiver',
  'Student',
  'Other',
]);

/** Same rules as learner profile for /auth/me profileComplete — used for payouts and honorarium. */
export function isProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): boolean {
  if (!user || !user.specialty?.trim()) return false;
  if (NON_HCP_SPECIALTIES.has(user.specialty.trim())) return true;
  const npi = (user.npiNumber || '').replace(/\D/g, '');
  return npi.length === 10;
}

export function assertProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): void {
  if (isProfileCompleteForPayments(user)) return;
  if (!user?.specialty?.trim()) {
    throw new BadRequestException(
      'Add your profession under Settings before you can set up payments or request an honorarium.',
    );
  }
  throw new BadRequestException(
    'Add your 10-digit NPI under Settings before you can set up payments or request an honorarium. (NPI is not required for non-clinical / Industry roles.)',
  );
}
