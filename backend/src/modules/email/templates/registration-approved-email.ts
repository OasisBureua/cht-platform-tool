import { ProgramZoomSessionType } from '@prisma/client';
import {
  E,
  emailWrap,
  emailButton,
  emailInfoCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

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
 * Branded HTML + plain text for "registration approved" (Amazon SES Simple body).
 */
export function buildRegistrationApprovedEmail(
  p: RegistrationApprovedTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const host    = p.hostDisplayName?.trim() ? escape(p.hostDisplayName.trim()) : null;

  const when          = formatEventWhen(p.startDate, p.durationMinutes, escape);
  const formatLine    = p.sessionKind === ProgramZoomSessionType.MEETING
    ? 'CHM Office Hours (interactive Q&A; join from the platform)'
    : 'Live session (virtual; attend from the platform)';
  const honorariumLine  = formatHonorariumLine(p.honorariumCents, escape);
  const zoomPlain       = p.zoomJoinUrl?.trim() || '';
  const participationLine = p.sessionKind === ProgramZoomSessionType.MEETING
    ? 'Interactive Q&A in a small-group format when applicable.'
    : 'Interactive Q&A with faculty and your peers, plus access to the session from your device.';
  const bodyIntro       = buildIntroParagraphs(p, escape);

  const subject = `You're approved — ${p.programTitle}`;

  // ── Calendar block (plain text) ──────────────────────────────────────────────
  const calendarBlock: string[] = [];
  if (p.calendarInviteIncluded && p.startDate) {
    calendarBlock.push('');
    if (p.googleCalendarUrl) {
      calendarBlock.push(
        'Calendar: open the attached live-session.ics file, or add to Google Calendar:',
        p.googleCalendarUrl,
      );
    } else {
      calendarBlock.push('Calendar: open the attached live-session.ics file to add this session to your calendar.');
    }
  }

  // ── Plain text ───────────────────────────────────────────────────────────────
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
    '',
    `Open your session in the Community Health Media app:`,
    p.appSessionUrl,
    ...calendarBlock,
    '',
    "You're confirmed for this session. Join details and the Zoom experience are available on the session page in the app when it's time to attend.",
    '',
    `If you have any questions or need assistance before the event, contact us at ${p.supportEmail}.`,
    '',
    'Best regards,',
    'The Community Health Media Team',
  ]
    .filter((line) => line != null)
    .join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const calendarHtml = p.calendarInviteIncluded && p.startDate
    ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.65;color:${E.MUTED}">
        <strong style="color:${E.BODY_TEXT}">Calendar invite</strong> — A <code style="font-size:12px">live-session.ics</code> file is attached to this email.${
          p.googleCalendarUrl
            ? ` You can also <a href="${escape(p.googleCalendarUrl)}" style="color:${E.LINK};font-weight:600">add to Google Calendar</a>.`
            : ''
        }
      </p>`
    : '';

  const detailRows = [
    `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Format</td><td style="padding:5px 0;font-size:13px;color:${E.BODY_TEXT}">${escape(formatLine)}</td></tr>`,
    honorariumLine ? `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Compensation</td><td style="padding:5px 0;font-size:13px;color:${E.BODY_TEXT}">${honorariumLine.html}</td></tr>` : '',
    `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Date &amp; Time</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${when.html}</td></tr>`,
    host ? `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Faculty / Host</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${host}</td></tr>` : '',
    zoomPlain ? `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Zoom</td><td style="padding:5px 0;word-break:break-all"><a href="${escape(zoomPlain)}" style="color:${E.LINK};font-weight:600">${escape(zoomPlain)}</a></td></tr>` : '',
  ].filter(Boolean).join('');

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${first}</strong>,</p>
    <p style="margin:0 0 20px;color:${E.MUTED};font-size:15px;line-height:1.6">
      Your registration has been <strong style="color:${E.BODY_TEXT}">approved</strong> for the following session:
    </p>

    ${emailInfoCard(`
      <p style="margin:0 0 14px;font-size:18px;font-weight:700;color:${E.HEADER_BG};line-height:1.3">${title}</p>
      ${bodyIntro.htmlBlocks}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:10px">${detailRows}</table>
    `)}

    ${calendarHtml}

    <p style="margin:24px 0 12px;color:${E.MUTED};font-size:14px;line-height:1.6">
      You're confirmed. Open the session page for join links, timing, and any pre-event steps:
    </p>
    ${emailButton(escape(p.appSessionUrl), 'Open Session in App')}
    ${emailUrlLine(escape(p.appSessionUrl))}

    <p style="margin:24px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6">
      Come prepared to ask questions, share perspectives, and engage with the discussion where invited.
    </p>
    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'Registration Approved', body });
  return { subject, text, html };
}

function buildIntroParagraphs(
  p: RegistrationApprovedTemplateInput,
  escape: (s: string) => string,
): { textBlocks: string[]; htmlBlocks: string } {
  const desc = truncatePlain(sanitizeForPlainEmail(p.programDescription), 500);
  if (!desc) return { textBlocks: [], htmlBlocks: '' };
  return {
    textBlocks: ['Session overview: ' + desc, ''],
    htmlBlocks: `<p style="margin:12px 0 0;line-height:1.6;color:${E.MUTED};font-size:13px">${escape(desc)}</p>`,
  };
}

function sanitizeForPlainEmail(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncatePlain(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
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
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  }).format(start);
  const dur = durationMin && durationMin > 0 ? ` (approx. ${durationMin} min)` : '';
  const line = long + dur;
  return { plain: line, html: escape(line) };
}

function formatHonorariumLine(
  honorariumCents: number | null,
  escape: (s: string) => string,
): { plain: string; html: string } | null {
  if (honorariumCents == null || honorariumCents <= 0) return null;
  const dollars = honorariumCents / 100;
  const formatted = dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const p = `Listed honorarium for this program: ${formatted} (subject to eligibility, completion, and program policy).`;
  return { plain: p, html: escape(p) };
}
