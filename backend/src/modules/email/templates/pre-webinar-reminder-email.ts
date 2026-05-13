import {
  E,
  emailWrap,
  emailButton,
  emailInfoCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type PreWebinarReminderTemplateInput = {
  firstName: string;
  programTitle: string;
  programDescription?: string | null;
  startDate: Date | null;
  durationMinutes: number | null;
  /** Zoom join URL — displayed prominently as the primary CTA. */
  zoomJoinUrl: string | null;
  hostDisplayName: string | null;
  sponsorName: string;
  appSessionUrl: string;
  supportEmail: string;
  /**
   * How many hours until the session starts — used to personalize the subject line.
   * Pass 24 for the day-before reminder, 1 for the 1-hour reminder, etc.
   */
  hoursUntilStart: number;
};

/**
 * Branded HTML + plain text reminder sent to approved attendees before a webinar.
 * Designed for both a day-before (24 h) and a same-day (1 h) send.
 */
export function buildPreWebinarReminderEmail(
  p: PreWebinarReminderTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const host    = p.hostDisplayName?.trim() ? escape(p.hostDisplayName.trim()) : null;
  const zoomUrl = p.zoomJoinUrl?.trim() ? escape(p.zoomJoinUrl.trim()) : null;

  const when     = formatEventWhen(p.startDate, p.durationMinutes, escape);
  const descPlain = p.programDescription
    ? sanitizePlainDescription(p.programDescription).slice(0, 300)
    : null;

  const timeLabel = p.hoursUntilStart <= 1
    ? 'starting soon'
    : p.hoursUntilStart <= 2
      ? 'in about an hour'
      : p.hoursUntilStart <= 4
        ? 'in a few hours'
        : p.hoursUntilStart <= 24
          ? 'tomorrow'
          : `in ${Math.round(p.hoursUntilStart / 24)} days`;

  const subject = `Reminder: "${p.programTitle}" is ${timeLabel}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `Just a reminder that "${p.programTitle}" is coming up ${timeLabel}.`,
    '',
    'Session details',
    '───────────────',
    `When: ${when.plain}`,
    host ? `Faculty / host: ${p.hostDisplayName}` : null,
    `Sponsored by: ${p.sponsorName}`,
    '',
    descPlain ? `About: ${descPlain}` : null,
    descPlain ? '' : null,
    zoomUrl ? 'Join with Zoom:' : null,
    zoomUrl ? p.zoomJoinUrl : null,
    zoomUrl ? '' : null,
    'Or join from the app:',
    p.appSessionUrl,
    '',
    'Quick tips:',
    '• Join 2–3 minutes early to test your audio.',
    '• Keep questions ready — there will be time for Q&A.',
    zoomUrl ? '• The Zoom link above is your direct join link — no waiting room password needed.' : null,
    '',
    `Questions? Reach us at ${p.supportEmail}.`,
    '',
    'We look forward to seeing you.',
    '',
    'Best regards,',
    'The Community Health Media Team',
    sponsor !== 'Community Health Media' ? `\nSponsored by ${p.sponsorName}.` : null,
  ]
    .filter((line) => line != null)
    .join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const detailRows = [
    `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Date &amp; Time</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${when.html}</td></tr>`,
    host ? `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Faculty / Host</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${host}</td></tr>` : '',
    `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Sponsored by</td><td style="padding:5px 0;color:${E.BODY_TEXT}">${sponsor}</td></tr>`,
  ].filter(Boolean).join('');

  const descHtml = descPlain
    ? `<p style="margin:14px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6;border-top:1px solid ${E.BORDER};padding-top:14px">${escape(descPlain)}</p>`
    : '';

  const tipsHtml = `
    <div style="background:#f9fafb;border:1px solid ${E.BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${E.BODY_TEXT}">Quick tips</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:${E.MUTED}">
        <li>Join 2&ndash;3 minutes early to test your audio.</li>
        <li>Keep questions ready &mdash; there will be time for Q&amp;A.</li>
        ${zoomUrl ? '<li>The Zoom link above is your direct join link.</li>' : ''}
      </ul>
    </div>`;

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${first}</strong>,</p>
    <p style="margin:0 0 20px;color:${E.MUTED};font-size:15px;line-height:1.6">
      Just a reminder that <strong style="color:${E.BODY_TEXT}">${title}</strong> is coming up
      <strong style="color:${E.ACCENT_DARK}">${escape(timeLabel)}</strong>.
    </p>

    ${emailInfoCard(`
      <p style="margin:0 0 14px;font-size:18px;font-weight:700;color:${E.HEADER_BG};line-height:1.3">${title}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${detailRows}</table>
      ${descHtml}
      ${zoomUrl ? `<div style="margin-top:16px">${emailButton(zoomUrl, 'Join on Zoom')}</div>` : ''}
    `)}

    ${zoomUrl ? `
      <p style="margin:16px 0 0;color:${E.MUTED};font-size:13px">
        Or open the <a href="${escape(p.appSessionUrl)}" style="color:${E.LINK}">session page in the app</a> to join.
      </p>` : `
      <p style="margin:20px 0 12px;color:${E.MUTED};font-size:14px;line-height:1.6">Join the session from the app:</p>
      ${emailButton(escape(p.appSessionUrl), 'Open Session')}
      ${emailUrlLine(escape(p.appSessionUrl))}
    `}

    ${tipsHtml}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'Session Reminder', body });
  return { subject, text, html };
}

function formatEventWhen(
  start: Date | null,
  durationMin: number | null,
  escape: (s: string) => string,
): { plain: string; html: string } {
  if (!start) {
    return {
      plain: 'See the app for the latest schedule.',
      html: escape('See the app for the latest schedule.'),
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

function sanitizePlainDescription(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
