import { ProgramZoomSessionType } from '@prisma/client';

export type RegistrationApprovedTemplateInput = {
  firstName: string;
  programTitle: string;
  programDescription: string;
  startDate: Date | null;
  durationMinutes: number | null;
  honorariumCents: number | null;
  hostDisplayName: string | null;
  sponsorName: string;
  /** Populated when the program has a Zoom join URL (added to calendar + body). */
  zoomJoinUrl?: string | null;
  sessionKind: ProgramZoomSessionType;
  appSessionUrl: string;
  supportEmail: string;
  /** Optional Google Calendar deep link */
  googleCalendarUrl?: string | null;
  /** True when email includes an .ics attachment (copy mentions calendar file). */
  calendarInviteIncluded?: boolean;
};

/**
 * Branded HTML + plain text for “registration approved” (Amazon SES Simple body).
 * Content follows CHM’s educational-session tone; dynamic fields are escaped in the builder.
 */
export function buildRegistrationApprovedEmail(
  p: RegistrationApprovedTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const host = p.hostDisplayName?.trim() ? escape(p.hostDisplayName.trim()) : null;

  const when = formatEventWhen(p.startDate, p.durationMinutes, escape);
  const formatLine =
    p.sessionKind === ProgramZoomSessionType.MEETING
      ? 'CHM Office Hours (interactive Q&A; join from the platform)'
      : 'Live session (virtual; attend from the platform)';

  const honorariumLine = formatHonorariumLine(p.honorariumCents, escape);
  const zoomPlain = p.zoomJoinUrl?.trim() || '';
  const participationLine =
    p.sessionKind === ProgramZoomSessionType.MEETING
      ? 'Interactive Q&A in a small-group format when applicable.'
      : 'Interactive Q&A with faculty and your peers, plus access to the session from your device.';

  const bodyIntro = buildIntroParagraphs(p, escape);

  const subject = `You're approved — ${p.programTitle}`;

  const calendarBlock: string[] = [];
  if (p.calendarInviteIncluded && p.startDate) {
    calendarBlock.push('');
    if (p.googleCalendarUrl) {
      calendarBlock.push(
        'Calendar: open the attached live-session.ics file (best for Outlook & Apple Calendar), or add to Google Calendar:',
        p.googleCalendarUrl,
      );
    } else {
      calendarBlock.push('Calendar: open the attached live-session.ics file to add this session to your calendar.');
    }
  }

  const text = [
    `Thank you, ${p.firstName.trim() || 'there'},`,
    '',
    `Your registration has been approved for the following live session: ${p.programTitle}.`,
    ...bodyIntro.textBlocks,
    '',
    'Event details',
    '────────────',
    `Format: ${formatLine}`,
    honorariumLine ? `Compensation: ${honorariumLine.plain}` : null,
    `When: ${when.plain}`,
    zoomPlain ? `Zoom: ${zoomPlain}` : null,
    `Participation: ${participationLine}`,
    host ? `Faculty / host: ${p.hostDisplayName}` : null,
    `Sponsored by: ${p.sponsorName}`,
    '',
    `Open your session in the Community Health Media app:`,
    p.appSessionUrl,
    ...calendarBlock,
    '',
    "You're confirmed for this session. Join details and the Zoom experience are available on the session page in the app when it's time to attend.",
    '',
    "If you have any questions or need assistance before the event, contact us at " + p.supportEmail + '.',
    '',
    'Best regards,',
    'The Community Health Media Team',
  ]
    .filter((line) => line != null)
    .join('\n');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 8px 28px;">
            <p style="margin:0 0 16px 0;font-size:17px;line-height:1.5;">Thank you, <strong>${first}</strong>,</p>
            <p style="margin:0 0 16px 0;line-height:1.6;">Your registration has been <strong>approved</strong> for the following live session:</p>
            <p style="margin:0 0 8px 0;font-size:18px;font-weight:600;color:#111827;">${title}</p>
            ${bodyIntro.htmlBlocks}
            <h2 style="margin:24px 0 10px 0;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Event details</h2>
            <table role="presentation" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:0;">
              <tr><td style="padding:16px 18px;line-height:1.65;">
                <p style="margin:0 0 8px 0;"><strong>Format</strong> — ${escape(formatLine)}</p>
                ${honorariumLine ? `<p style="margin:0 0 8px 0;"><strong>Compensation</strong> — ${honorariumLine.html}</p>` : ''}
                <p style="margin:0 0 8px 0;"><strong>When</strong> — ${when.html}</p>
                ${
                  zoomPlain
                    ? `<p style="margin:0 0 8px 0;"><strong>Zoom</strong> — <a href="${escape(zoomPlain)}" style="color:#2563eb;font-weight:600;word-break:break-all;">${escape(zoomPlain)}</a></p>`
                    : ''
                }
                <p style="margin:0 0 8px 0;"><strong>Participation</strong> — ${escape(participationLine)}</p>
                ${host ? `<p style="margin:0 0 8px 0;"><strong>Faculty / host</strong> — ${host}</p>` : ''}
                <p style="margin:0;"><strong>Sponsored by</strong> — ${sponsor}</p>
              </td></tr>
            </table>
            <p style="margin:22px 0 12px 0;line-height:1.6;">You’re confirmed for this session. Open the app for join links, timing, and any pre-event steps:</p>
            <p style="margin:0 0 8px 0;">
              <a href="${escape(p.appSessionUrl)}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Open session in the app</a>
            </p>
            <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;word-break:break-all;">
              <a href="${escape(p.appSessionUrl)}" style="color:#4b5563;">${escape(p.appSessionUrl)}</a>
            </p>
            ${
              p.calendarInviteIncluded && p.startDate
                ? `<p style="margin:20px 0 0 0;font-size:14px;line-height:1.65;color:#374151;"><strong>Calendar</strong> — An invitation file (<span style="font-family:ui-monospace,Menlo,monospace;font-size:13px;">live-session.ics</span>) is attached to this email.${
                    p.googleCalendarUrl
                      ? ` You can also <a href="${escape(p.googleCalendarUrl)}" style="color:#2563eb;font-weight:600;">add to Google Calendar</a>.`
                      : ''
                  }</p>`
                : ''
            }
            <p style="margin:24px 0 0 0;line-height:1.6;">We ask participants to come prepared to ask questions, share perspectives, and engage with the discussion where invited.</p>
            <p style="margin:16px 0 0 0;line-height:1.6;">If you have any questions or need assistance before the event, contact us at <a href="mailto:${support}" style="color:#2563eb;">${support}</a>.</p>
            <p style="margin:24px 0 0 0;line-height:1.5;">Best regards,<br /><strong>The Community Health Media Team</strong></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject, text, html };
}

function buildIntroParagraphs(
  p: RegistrationApprovedTemplateInput,
  escape: (s: string) => string,
): { textBlocks: string[]; htmlBlocks: string } {
  const desc = truncatePlain(sanitizeForPlainEmail(p.programDescription), 500);
  if (!desc) {
    return { textBlocks: [], htmlBlocks: '' };
  }
  const t = 'Session overview: ' + desc;
  return {
    textBlocks: [t, ''],
    htmlBlocks: `<p style="margin:12px 0 0 0;line-height:1.6;color:#374151;">${escape(desc)}</p>`,
  };
}

function sanitizeForPlainEmail(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncatePlain(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length <= max) {
    return t;
  }
  return t.slice(0, max - 1).trimEnd() + '…';
}

function formatEventWhen(
  start: Date | null,
  durationMin: number | null,
  escape: (s: string) => string,
): { plain: string; html: string } {
  if (!start) {
    return {
      plain: 'See the app for the latest schedule for this session.',
      html: escape('See the app for the latest schedule for this session.'),
    };
  }
  const long = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(start);
  const dur = durationMin && durationMin > 0 ? ` (approx. ${durationMin} min)` : '';
  const line = long + dur;
  return { plain: line, html: escape(line) };
}

function formatHonorariumLine(
  honorariumCents: number | null,
  escape: (s: string) => string,
): { plain: string; html: string } | null {
  if (honorariumCents == null || honorariumCents <= 0) {
    return null;
  }
  const dollars = honorariumCents / 100;
  const formatted = dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const p = `Listed honorarium for this program: ${formatted} (subject to eligibility, completion, and program policy).`;
  return { plain: p, html: escape(p) };
}
