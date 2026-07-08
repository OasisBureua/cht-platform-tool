import { createHash } from 'crypto';

/** Stable short hash for cache keys from query/path params. */
export function cacheKeyHash(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex')
    .slice(0, 16);
}
