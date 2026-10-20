import { NON_HCP_PROFESSIONS } from '../data/profession-options';

export type ProfileMissingField =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'profession'
  | 'npi';

/** Labels for notification / payments copy (only list fields that are missing). */
export const PROFILE_MISSING_FIELD_LABEL: Record<ProfileMissingField, string> = {
  firstName: 'first name',
  lastName: 'last name',
  phone: 'mobile phone',
  profession: 'profession',
  npi: 'NPI',
};

export function formatMissingProfileFields(
  missing: ProfileMissingField[] | null | undefined,
): string {
  const labels = (missing ?? []).map((f) => PROFILE_MISSING_FIELD_LABEL[f]);
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
}

function isUsableFirstName(value: string | null | undefined): boolean {
  const t = (value ?? '').trim();
  if (!t) return false;
  if (/^user$/i.test(t)) return false;
  return true;
}

function isUsableLastName(value: string | null | undefined): boolean {
  return Boolean((value ?? '').trim());
}

/** Client-side mirror of backend listMissingProfilePaymentFields when APIs omit the list. */
export function listMissingProfileFields(user: {
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  specialty?: string | null;
  npiNumber?: string | null;
  profileMissingFields?: ProfileMissingField[] | null;
}): ProfileMissingField[] {
  if (Array.isArray(user.profileMissingFields)) {
    return user.profileMissingFields;
  }
  const missing: ProfileMissingField[] = [];
  if (!isUsableFirstName(user.firstName)) missing.push('firstName');
  if (!isUsableLastName(user.lastName)) missing.push('lastName');
  if (!user.phoneNumber?.trim()) missing.push('phone');
  if (!user.specialty?.trim()) missing.push('profession');
  else if (!NON_HCP_PROFESSIONS.has(user.specialty.trim())) {
    const npi = (user.npiNumber ?? '').replace(/\D/g, '');
    if (npi.length !== 10) missing.push('npi');
  }
  return missing;
}

/** First + last name required before webinar registration. */
export function listMissingProfileNameFields(user: {
  firstName?: string | null;
  lastName?: string | null;
}): Array<'firstName' | 'lastName'> {
  const missing: Array<'firstName' | 'lastName'> = [];
  if (!isUsableFirstName(user.firstName)) missing.push('firstName');
  if (!isUsableLastName(user.lastName)) missing.push('lastName');
  return missing;
}
