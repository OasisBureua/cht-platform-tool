/** Minimal iCalendar (ICS) for calendar invites (download / attach). */

function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') + 'Z';
}

function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function buildProgramSessionIcs(opts: {
  title: string;
  description: string;
  start: Date;
  end: Date;
  joinUrl?: string;
  uid?: string;
}): string {
  const uid = opts.uid || `cht-${opts.start.getTime()}@program-session`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CHT Platform//Program Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(opts.start)}`,
    `DTEND:${formatIcsUtc(opts.end)}`,
    `SUMMARY:${escapeText(opts.title)}`,
    `DESCRIPTION:${escapeText([opts.description, opts.joinUrl ? `Join: ${opts.joinUrl}` : ''].filter(Boolean).join('\\n'))}`,
  ];
  if (opts.joinUrl) {
    lines.push(`URL:${opts.joinUrl}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}
