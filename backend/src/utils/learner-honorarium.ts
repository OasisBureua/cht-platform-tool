/** Learner-facing honorarium visibility (amounts stay admin-only). */
export function learnerHonorariumFlags(cents: number | null | undefined): {
  hasHonorarium: boolean;
} {
  return { hasHonorarium: (cents ?? 0) > 0 };
}
