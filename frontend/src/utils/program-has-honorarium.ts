/** True when a program/survey offers an honorarium (amount may be redacted for learners). */
export function programHasHonorarium(p?: {
  hasHonorarium?: boolean;
  honorariumAmount?: number | null;
} | null): boolean {
  if (!p) return false;
  if (typeof p.hasHonorarium === 'boolean') return p.hasHonorarium;
  return p.honorariumAmount != null && p.honorariumAmount > 0;
}
