/**
 * W-9 format validation for IRS compliance.
 * Rejects known-invalid SSN/EIN patterns per IRS/SSA rules.
 */

/** Invalid SSN area numbers (first 3 digits) - never assigned by SSA */
const INVALID_SSN_AREAS = new Set([
  0, 666,  // 000 and 666 never assigned
  ...Array.from({ length: 100 }, (_, i) => 900 + i), // 900-999 never assigned
]);

/** Invalid EIN prefixes (first 2 digits) - per IRS no longer assigned */
const INVALID_EIN_PREFIXES = new Set([
  0, 7, 8, 9, 17, 18, 19, 28, 29, 49, 69, 70, 78, 79, 89, 96, 97,
]);

export interface W9ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate SSN format per IRS/SSA rules.
 * - 9 digits
 * - Area (first 3): not 000, 666, 900-999
 * - Group (middle 2): not 00
 * - Serial (last 4): not 0000
 */
export function validateSSN(digits: string): W9ValidationResult {
  if (!/^\d{9}$/.test(digits)) {
    return { valid: false, error: 'SSN must be exactly 9 digits' };
  }
  const area = parseInt(digits.slice(0, 3), 10);
  const group = parseInt(digits.slice(3, 5), 10);
  const serial = parseInt(digits.slice(5, 9), 10);

  if (INVALID_SSN_AREAS.has(area)) {
    return { valid: false, error: 'Invalid SSN format' };
  }
  if (group === 0) {
    return { valid: false, error: 'Invalid SSN format' };
  }
  if (serial === 0) {
    return { valid: false, error: 'Invalid SSN format' };
  }
  return { valid: true };
}

/**
 * Validate EIN format per IRS rules.
 * - 9 digits
 * - Prefix (first 2): not in invalid list (00, 07, 08, 09, etc.)
 */
export function validateEIN(digits: string): W9ValidationResult {
  if (!/^\d{9}$/.test(digits)) {
    return { valid: false, error: 'EIN must be exactly 9 digits' };
  }
  const prefix = parseInt(digits.slice(0, 2), 10);
  if (INVALID_EIN_PREFIXES.has(prefix)) {
    return { valid: false, error: 'Invalid EIN format' };
  }
  return { valid: true };
}

/**
 * Validate W-9 tax ID (SSN or EIN).
 */
export function validateTaxId(
  digits: string,
  taxIdType: 'SSN' | 'EIN',
): W9ValidationResult {
  const cleaned = digits.replace(/\D/g, '');
  if (cleaned.length !== 9) {
    return {
      valid: false,
      error: taxIdType === 'SSN' ? 'SSN must be 9 digits' : 'EIN must be 9 digits',
    };
  }
  return taxIdType === 'SSN' ? validateSSN(cleaned) : validateEIN(cleaned);
}

/**
 * Sanitize optional company name for W-9.
 * Max 200 chars, trim, reject empty-looking strings.
 */
export function sanitizeCompanyName(value: string | undefined): string | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
}
