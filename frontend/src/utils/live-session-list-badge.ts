import type { MyLiveSessionListStatus } from '../api/programs';

/** Pill label next to Live / Office Hours titles when the user is in good standing to attend. */
export function liveSessionListBadgeLabel(
  registrationRequiresApproval: boolean | undefined,
  status: MyLiveSessionListStatus | undefined,
): string | null {
  if (!status) return null;
  const ok = status.enrolled || status.registrationStatus === 'APPROVED';
  if (!ok) return null;
  return registrationRequiresApproval ? 'Approved' : 'Registered';
}
