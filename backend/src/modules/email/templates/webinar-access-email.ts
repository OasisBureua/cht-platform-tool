import {
  E,
  emailWrap,
  emailButton,
  emailInfoCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type WebinarAccessTemplateInput = {
  firstName: string;
  programTitle: string;
  programDescription?: string | null;
  startDate: Date | null;
  durationMinutes: number | null;
  /** Zoom join URL. Required for this email to be meaningful. */
  zoomJoinUrl: string;
  hostDisplayName: string | null;
  sponsorName: string;
  appSessionUrl: string;
  supportEmail: string;
};

/**
 * Branded HTML + plain text sent to approved attendees with their Zoom join link.
 * Intended to be sent 24–48 hours before the webinar (or immediately upon approval when the event is imminent).
 */
export function buildWebinarAccessEmail(
  p: WebinarAccessTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const host    = p.hostDisplayName?.trim() ? escape(p.hostDisplayName.trim()) : null;
  const zoomUrl = escape(p.zoomJoinUrl.trim());

  const when     = formatEventWhen(p.startDate, p.durationMinutes, escape);
  const descPlain = p.programDescription
    ? sanitizePlainDescription(p.programDescription).slice(0, 400)
    : null;

  const subject = `Your Zoom link is ready — ${p.programTitle}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `Your session is coming up. Here are your access details for "${p.programTitle}."`,
    '',
    descPlain ? descPlain : null,
    descPlain ? '' : null,
    'Session details',
    '───────────────',
    `When: ${when.plain}`,
    host ? `Faculty / host: ${p.hostDisplayName}` : null,
    '',
    'Join with Zoom:',
    p.zoomJoinUrl,
    '',
    'You can also join directly from the app:',
    p.appSessionUrl,
    '',
    'Tips for joining:',
    '• Download or update the Zoom app before the session.',
    '• Join 2–3 minutes early to test your audio.',
    '• Your microphone will be muted by default; you can unmute to ask questions when prompted.',
    '',
    `Questions before the event? Reach us at ${p.supportEmail}.`,
    '',
    'We look forward to seeing you there.',
    '',
    'Best regards,',
    'The Community Health Media Team',
  ]
    .filter((line) => line != null)
    .join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const detailRows = [
    `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Date &amp; Time</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${when.html}</td></tr>`,
    host ? `<tr><td style="padding:5px 12px 5px 0;color:${E.LABEL};font-size:13px;white-space:nowrap;vertical-align:top">Faculty / Host</td><td style="padding:5px 0;font-weight:600;color:${E.BODY_TEXT}">${host}</td></tr>` : '',
  ].filter(Boolean).join('');

  const descHtml = descPlain
    ? `<p style="margin:14px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6;border-top:1px solid ${E.BORDER};padding-top:14px">${escape(descPlain)}</p>`
    : '';

  const tipsHtml = `
    <div style="background:#f9fafb;border:1px solid ${E.BORDER};border-radius:10px;padding:14px 18px;margin:20px 0 0">
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${E.BODY_TEXT}">Tips for joining</p>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:${E.MUTED}">
        <li>Download or update the Zoom app before the session.</li>
        <li>Join 2&ndash;3 minutes early to test your audio.</li>
        <li>Your microphone will be muted by default; unmute when prompted to ask questions.</li>
      </ul>
    </div>`;

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${first}</strong>,</p>
    <p style="margin:0 0 20px;color:${E.MUTED};font-size:15px;line-height:1.6">
      Your session is coming up. Here are your access details for <strong style="color:${E.BODY_TEXT}">${title}</strong>.
    </p>

    ${emailInfoCard(`
      <p style="margin:0 0 14px;font-size:18px;font-weight:700;color:${E.HEADER_BG};line-height:1.3">${title}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">${detailRows}</table>
      ${descHtml}
      <div style="margin-top:16px">${emailButton(zoomUrl, 'Join on Zoom')}</div>
      <p style="margin:10px 0 0;font-size:12px;color:${E.LABEL};word-break:break-all">
        <a href="${zoomUrl}" style="color:${E.LABEL}">${zoomUrl}</a>
      </p>
    `)}

    <p style="margin:20px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6">
      You can also join from the <a href="${escape(p.appSessionUrl)}" style="color:${E.LINK}">session page in the app</a>.
    </p>

    ${tipsHtml}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'Your Zoom Link', body });
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
