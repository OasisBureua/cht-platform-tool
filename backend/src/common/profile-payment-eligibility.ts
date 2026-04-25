import { BadRequestException } from '@nestjs/common';

export type ProfilePaymentFields = { specialty: string | null; npiNumber: string | null };

/** Same rules as learner profile for /auth/me profileComplete — used for payouts and honorarium. */
export function isProfileCompleteForPayments(user: ProfilePaymentFields | null | undefined): boolean {
  if (!user || !user.specialty?.trim()) return false;
  if (user.specialty.trim() === 'Pharmaceuticals') return true;
  const npi = (user.npiNumber || '').replace(/\D/g, '');
  return npi.length === 10;
}

export function assertProfileCompleteForPayments(user: ProfilePaymentFields | null | undefined): void {
  if (isProfileCompleteForPayments(user)) return;
  if (!user?.specialty?.trim()) {
    throw new BadRequestException(
      'Add your profession under Settings before you can set up payments or request an honorarium.',
    );
  }
  throw new BadRequestException(
    'Add your 10-digit NPI under Settings before you can set up payments or request an honorarium. (NPI is not required if your profession is Pharmaceuticals.)',
  );
}
