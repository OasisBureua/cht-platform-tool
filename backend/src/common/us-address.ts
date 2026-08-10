/** US states + DC (2-letter codes). */
export const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
]);

/** Normalize to a 2-letter US state/DC code, or null if empty/invalid. */
export function normalizeUsStateCode(
  raw: string | null | undefined,
): string | null {
  const t = raw?.trim().toUpperCase();
  if (!t) return null;
  return US_STATE_CODES.has(t) ? t : null;
}

/** Exactly 5 digits (no ZIP+4). */
export function normalizeUsZip5(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length === 5 ? digits : null;
}

/** Validate registration location: state + 5-digit ZIP required; city optional. */
export function validateRegistrationLocation(opts: {
  state?: string | null;
  zipCode?: string | null;
}): string | null {
  const state = normalizeUsStateCode(opts.state);
  if (!state) return 'State is required.';
  const zip = normalizeUsZip5(opts.zipCode);
  if (!zip) return 'ZIP code must be exactly 5 digits.';
  return null;
}
