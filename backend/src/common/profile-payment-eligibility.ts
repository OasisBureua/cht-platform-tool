import { BadRequestException } from '@nestjs/common';

export type ProfilePaymentFields = {
  specialty: string | null;
  npiNumber: string | null;
  /** E.164 mobile; required for profile completeness (SMS MFA + contact). */
  phoneNumber?: string | null;
};

/**
 * Specialties that are non-clinical / non-HCP and therefore do not require an NPI.
 * Keep in sync with frontend `NON_HCP_PROFESSIONS` (profession-options.ts).
 * 'Pharmaceuticals' / 'Student' / 'Researcher' remain for legacy DB rows.
 */
export const NON_HCP_SPECIALTIES = new Set([
  'Industry',
  'Pharmaceuticals',
  'StudentResearcher',
  'Researcher',
  'Patient Advocate',
  'Caregiver',
  'Student',
  'Other',
]);

export type ProfileMissingField = 'phone' | 'profession' | 'npi';

/** Same rules as learner profile for /auth/me profileComplete, used for payouts and honorarium. */
export function isProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): boolean {
  return listMissingProfilePaymentFields(user).length === 0;
}

/** Which required payment/profile fields are still empty (order matches UX copy). */
export function listMissingProfilePaymentFields(
  user: ProfilePaymentFields | null | undefined,
): ProfileMissingField[] {
  const missing: ProfileMissingField[] = [];
  if (!user?.phoneNumber?.trim()) missing.push('phone');
  if (!user?.specialty?.trim()) missing.push('profession');
  else if (!NON_HCP_SPECIALTIES.has(user.specialty.trim())) {
    const npi = (user.npiNumber || '').replace(/\D/g, '');
    if (npi.length !== 10) missing.push('npi');
  }
  return missing;
}

export function assertProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): void {
  const missing = listMissingProfilePaymentFields(user);
  if (missing.length === 0) return;
  if (missing.includes('profession')) {
    throw new BadRequestException(
      'Add your profession under Settings before you can set up payments or request an honorarium.',
    );
  }
  if (missing.includes('phone')) {
    throw new BadRequestException(
      'Add your mobile phone number under Settings before you can set up payments or request an honorarium.',
    );
  }
  throw new BadRequestException(
    'Add your 10-digit NPI under Settings before you can set up payments or request an honorarium. (NPI is not required for non-clinical / Industry roles.)',
  );
}
