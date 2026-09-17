/**
 * Normalize a US-centric phone input to E.164 (+1XXXXXXXXXX).
 * Returns null when fewer/more than 10 national digits (after optional leading 1).
 */
export function normalizeUsPhoneE164(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  let national = digits;
  if (digits.length === 11 && digits.startsWith('1')) {
    national = digits.slice(1);
  }
  if (national.length !== 10) return null;
  return `+1${national}`;
}

/** Mask +15551234567 → +1••••••4567 for UI display. */
export function maskPhoneE164(e164: string | null | undefined): string | null {
  if (!e164 || e164.length < 8) return e164 ?? null;
  return `${e164.slice(0, 2)}••••••${e164.slice(-4)}`;
}
