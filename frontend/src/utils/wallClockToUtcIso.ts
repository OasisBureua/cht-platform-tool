import { DateTime } from 'luxon';

/**
 * Turns admin-entered date + time into a UTC ISO string for the API.
 * Naive strings like `2026-04-29T09:45:00` are interpreted as UTC on the server — use this so the instant matches the chosen IANA timezone (e.g. America/New_York).
 */
export function wallClockToUtcIso(dateYmd: string, timeHm: string, ianaZone: string): string | null {
  const timePart = timeHm.split(':').length === 2 ? `${timeHm}:00` : timeHm;
  const dt = DateTime.fromISO(`${dateYmd}T${timePart}`, { zone: ianaZone });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO();
}
