import { DateTime } from 'luxon';

/** IANA zones used by admin schedulers, with Zoom/Outlook-style display names. */
export const SCHEDULER_TIMEZONES: ReadonlyArray<{ value: string; name: string }> = [
  { value: 'America/New_York', name: 'Eastern Time (US and Canada)' },
  { value: 'America/Chicago', name: 'Central Time (US and Canada)' },
  { value: 'America/Denver', name: 'Mountain Time (US and Canada)' },
  { value: 'America/Los_Angeles', name: 'Pacific Time (US and Canada)' },
  { value: 'America/Phoenix', name: 'Arizona' },
  { value: 'America/Anchorage', name: 'Alaska' },
  { value: 'Pacific/Honolulu', name: 'Hawaii' },
  { value: 'UTC', name: 'Coordinated Universal Time' },
];

/**
 * Label like `(GMT-4:00) Eastern Time (US and Canada)`.
 * Offset is computed for `atIsoDate` (yyyy-MM-dd) when provided so DST matches the event day.
 */
export function formatTimezoneLabel(
  ianaZone: string,
  friendlyName: string,
  atIsoDate?: string,
): string {
  const base =
    atIsoDate && /^\d{4}-\d{2}-\d{2}$/.test(atIsoDate)
      ? DateTime.fromISO(`${atIsoDate}T12:00:00`, { zone: ianaZone })
      : DateTime.now().setZone(ianaZone);
  const dt = base.isValid ? base : DateTime.now().setZone(ianaZone);
  const offsetMin = dt.offset;
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const gmt = `GMT${sign}${hours}:${String(minutes).padStart(2, '0')}`;
  return `(${gmt}) ${friendlyName}`;
}
