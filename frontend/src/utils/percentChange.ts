/**
 * Computes week-over-week percent change label for admin dashboard.
 * Used for Active HCPs: current = total active now, previous = active who existed 1 week ago.
 */
export function getPercentChangeLabel(
  current: number,
  previous: number
): { label: string; colorClass: string } {
  if (previous === 0) {
    return {
      label: current > 0 ? '+100%' : '0%',
      colorClass: current > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700',
    };
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  const prefix = rounded > 0 ? '+' : '';
  if (rounded > 0) return { label: `${prefix}${rounded}%`, colorClass: 'bg-green-100 text-green-700' };
  if (rounded < 0) return { label: `${rounded}%`, colorClass: 'bg-red-100 text-red-700' };
  return { label: '0%', colorClass: 'bg-yellow-100 text-yellow-700' };
}
