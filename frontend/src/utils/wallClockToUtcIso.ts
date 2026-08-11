import { DateTime } from 'luxon';

/**
 * Turns admin-entered date + time into a UTC ISO string for the API.
 * Naive strings like `2026-04-29T09:45:00` are interpreted as UTC on the server, use this so the instant matches the chosen IANA timezone (e.g. America/New_York).
 *
 * Milliseconds are suppressed: Zoom's API expects `yyyy-MM-ddTHH:mm:ssZ` and misparses
 * fractional seconds (e.g. treats `20:00:00.000Z` as 8:00 PM local Eastern instead of 4:00 PM).
 */
export function wallClockToUtcIso(dateYmd: string, timeHm: string, ianaZone: string): string | null {
  const timePart = timeHm.split(':').length === 2 ? `${timeHm}:00` : timeHm;
  const dt = DateTime.fromISO(`${dateYmd}T${timePart}`, { zone: ianaZone });
  if (!dt.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}
