/** ICS + MIME helpers for registration-approved emails (SES Raw API). */

export type LiveSessionIcsParams = {
  programId: string;
  title: string;
  description: string;
  start: Date;
  durationMinutes: number;
  /** In-app session page (always included in description). */
  appSessionUrl: string;
  /** Zoom webinar/meeting join URL when configured on the program (preferred for URL/LOCATION in the .ics). */
  zoomJoinUrl?: string | null;
  organizerEmail: string;
};

function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** Escape text for iCalendar TEXT fields */
function escapeIcsText(s: string): string {
  return s
    .replace(/\r?\n/g, '\\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

export function buildLiveSessionIcs(p: LiveSessionIcsParams): string {
  const uid = `${p.programId}-${p.start.getTime()}@communityhealth.media`;
  const dtStamp = formatIcsUtc(new Date());
  const dtStart = formatIcsUtc(p.start);
  const end = new Date(p.start.getTime() + Math.max(1, p.durationMinutes) * 60_000);
  const dtEnd = formatIcsUtc(end);
  const summary = escapeIcsText(p.title.slice(0, 500));
  const zoom = p.zoomJoinUrl?.trim() || '';
  /** Primary actionable link in calendar apps: Zoom when available, otherwise app session page. */
  const primaryUrl = zoom || p.appSessionUrl;
  const urlEsc = escapeIcsText(primaryUrl);

  const descLines = [
    p.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
    zoom ? `Join on Zoom: ${zoom}` : null,
    `Open in app: ${p.appSessionUrl}`,
  ].filter(Boolean);
  const descPlain = escapeIcsText(descLines.join('\n\n'));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Community Health Media//Live Session//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${descPlain}`,
    ...(zoom ? [`LOCATION:${escapeIcsText(zoom)}`] : []),
    `URL:${urlEsc}`,
    `ORGANIZER;CN=Community Health Media:mailto:${p.organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

/** Google Calendar “template” URL (fallback when clients block attachments). */
export function googleCalendarTemplateUrl(params: {
  title: string;
  details: string;
  start: Date;
  end: Date;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const dates = `${fmt(params.start)}/${fmt(params.end)}`;
  const q = new URLSearchParams();
  q.set('action', 'TEMPLATE');
  q.set('text', params.title.slice(0, 300));
  q.set('dates', dates);
  q.set('details', params.details.slice(0, 800));
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export type MimeApprovalEmailParams = {
  from: string;
  to: string;
  subject: string;
  textPlain: string;
  html: string;
  icsFilename: string;
  icsBody: string;
};

/** multipart/mixed: multipart/alternative (text + html) + text/calendar attachment */
export function buildApprovalEmailMimeBuffer(p: MimeApprovalEmailParams): Buffer {
  const boundaryMain = `mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const boundaryAlt = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const nl = '\r\n';

  const subjectEncoded = `=?UTF-8?B?${Buffer.from(p.subject, 'utf8').toString('base64')}?=`;

  const plainB64 = Buffer.from(p.textPlain, 'utf8').toString('base64').replace(/(.{76})/g, `$1${nl}`);
  const htmlB64 = Buffer.from(p.html, 'utf8').toString('base64').replace(/(.{76})/g, `$1${nl}`);
  const icsB64 = Buffer.from(p.icsBody, 'utf8').toString('base64').replace(/(.{76})/g, `$1${nl}`);

  const raw =
    [
      `From: ${p.from}`,
      `To: ${p.to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundaryMain}"`,
      '',
      `--${boundaryMain}`,
      `Content-Type: multipart/alternative; boundary="${boundaryAlt}"`,
      '',
      `--${boundaryAlt}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      plainB64,
      `--${boundaryAlt}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      htmlB64,
      `--${boundaryAlt}--`,
      '',
      `--${boundaryMain}`,
      `Content-Type: text/calendar; charset=UTF-8; method=PUBLISH; name="${p.icsFilename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${p.icsFilename}"`,
      '',
      icsB64,
      `--${boundaryMain}--`,
      '',
    ].join(nl) + nl;

  return Buffer.from(raw, 'utf8');
}
