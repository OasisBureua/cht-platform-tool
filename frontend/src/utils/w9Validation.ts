/**
 * W-9 format validation for IRS compliance.
 * Mirrors backend validation to catch errors before submit.
 */

/** Invalid SSN area numbers (first 3 digits) - never assigned by SSA */
const INVALID_SSN_AREAS = new Set([
  0, 666,
  ...Array.from({ length: 100 }, (_, i) => 900 + i),
]);

/** Invalid EIN prefixes (first 2 digits) - per IRS no longer assigned */
const INVALID_EIN_PREFIXES = new Set([
  0, 7, 8, 9, 17, 18, 19, 28, 29, 49, 69, 70, 78, 79, 89, 96, 97,
]);

export interface W9ValidationResult {
  valid: boolean;
  error?: string;
}

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
