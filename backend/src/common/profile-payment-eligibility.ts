import { BadRequestException } from '@nestjs/common';

export type ProfilePaymentFields = {
  firstName?: string | null;
  lastName?: string | null;
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

export type ProfileMissingField =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'profession'
  | 'npi';

/** Placeholder first names from OAuth / signup defaults are treated as unset. */
export function isUsableFirstName(value: string | null | undefined): boolean {
  const t = (value ?? '').trim();
  if (!t) return false;
  if (/^user$/i.test(t)) return false;
  return true;
}

export function isUsableLastName(value: string | null | undefined): boolean {
  return Boolean((value ?? '').trim());
}

/** Same rules as learner profile for /auth/me profileComplete, used for payouts and honorarium. */
export function isProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): boolean {
  return listMissingProfilePaymentFields(user).length === 0;
}

/** First + last name required before webinar registration. */
export function listMissingProfileNameFields(
  user: Pick<ProfilePaymentFields, 'firstName' | 'lastName'> | null | undefined,
): Array<'firstName' | 'lastName'> {
  const missing: Array<'firstName' | 'lastName'> = [];
  if (!isUsableFirstName(user?.firstName)) missing.push('firstName');
  if (!isUsableLastName(user?.lastName)) missing.push('lastName');
  return missing;
}

/** Which required payment/profile fields are still empty (order matches UX copy). */
export function listMissingProfilePaymentFields(
  user: ProfilePaymentFields | null | undefined,
): ProfileMissingField[] {
  const missing: ProfileMissingField[] = [
    ...listMissingProfileNameFields(user),
  ];
  if (!user?.phoneNumber?.trim()) missing.push('phone');
  if (!user?.specialty?.trim()) missing.push('profession');
  else if (!NON_HCP_SPECIALTIES.has(user.specialty.trim())) {
    const npi = (user.npiNumber || '').replace(/\D/g, '');
    if (npi.length !== 10) missing.push('npi');
  }
  return missing;
}

export function assertProfileHasNameForRegistration(
  user: Pick<ProfilePaymentFields, 'firstName' | 'lastName'> | null | undefined,
): void {
  const missing = listMissingProfileNameFields(user);
  if (missing.length === 0) return;
  throw new BadRequestException(
    'Add your first and last name under Settings before you can register for webinars.',
  );
}

export function assertProfileCompleteForPayments(
  user: ProfilePaymentFields | null | undefined,
): void {
  const missing = listMissingProfilePaymentFields(user);
  if (missing.length === 0) return;
  if (missing.includes('firstName') || missing.includes('lastName')) {
    throw new BadRequestException(
      'Add your first and last name under Settings before you can set up payments or request an honorarium.',
    );
  }
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
