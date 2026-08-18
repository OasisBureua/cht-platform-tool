import citiesByState from './us-cities-by-state.json';

type CitiesByState = Record<string, string[]>;

const BY_STATE = citiesByState as CitiesByState;

/** Cities for a US state/DC code (empty if unknown). */
export function citiesForState(stateCode: string | null | undefined): string[] {
  const code = stateCode?.trim().toUpperCase();
  if (!code) return [];
  return BY_STATE[code] ?? [];
}

/**
 * Typeahead suggestions for city, optionally scoped to a state.
 * Returns up to `limit` matches (prefix then includes).
 */
export function suggestCities(
  query: string,
  stateCode?: string | null,
  limit = 12,
): string[] {
  const q = query.trim().toLowerCase();
  if (q.length < 1) return [];

  const pool = stateCode
    ? citiesForState(stateCode)
    : Object.values(BY_STATE).flat();

  const prefix: string[] = [];
  const includes: string[] = [];
  for (const city of pool) {
    const lower = city.toLowerCase();
    if (lower.startsWith(q)) prefix.push(city);
    else if (lower.includes(q)) includes.push(city);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...includes].slice(0, limit);
}
