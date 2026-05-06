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
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const host = p.hostDisplayName?.trim() ? escape(p.hostDisplayName.trim()) : null;
  const zoomUrl = escape(p.zoomJoinUrl.trim());

  const when = formatEventWhen(p.startDate, p.durationMinutes, escape);

  const descPlain = p.programDescription
    ? sanitizePlainDescription(p.programDescription).slice(0, 400)
    : null;

  const subject = `Your Zoom link is ready — ${p.programTitle}`;

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
    `Sponsored by: ${p.sponsorName}`,
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
    sponsor !== 'Community Health Media' ? `\nSponsored by ${p.sponsorName}.` : null,
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
          <td style="padding:28px 28px 24px 28px;">
            <p style="margin:0 0 16px 0;font-size:17px;line-height:1.5;">Hi <strong>${first}</strong>,</p>
            <p style="margin:0 0 16px 0;line-height:1.6;">
              Your session is coming up. Here are your access details for <strong>${title}</strong>.
            </p>
            ${
              descPlain
                ? `<p style="margin:0 0 16px 0;line-height:1.6;color:#374151;font-size:14px;">${escape(descPlain)}</p>`
                : ''
            }
            <h2 style="margin:20px 0 10px 0;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Session details</h2>
            <table role="presentation" width="100%" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
              <tr><td style="padding:16px 18px;line-height:1.65;">
                <p style="margin:0 0 8px 0;"><strong>When</strong> — ${when.html}</p>
                ${host ? `<p style="margin:0 0 8px 0;"><strong>Faculty / host</strong> — ${host}</p>` : ''}
                <p style="margin:0;"><strong>Sponsored by</strong> — ${sponsor}</p>
              </td></tr>
            </table>
            <h2 style="margin:24px 0 10px 0;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Your Zoom link</h2>
            <p style="margin:0 0 12px 0;">
              <a href="${zoomUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Join on Zoom</a>
            </p>
            <p style="margin:0 0 20px 0;font-size:13px;color:#6b7280;word-break:break-all;">
              <a href="${zoomUrl}" style="color:#4b5563;">${zoomUrl}</a>
            </p>
            <p style="margin:0 0 16px 0;line-height:1.6;font-size:14px;color:#374151;">
              You can also join from the
              <a href="${escape(p.appSessionUrl)}" style="color:#2563eb;">session page in the app</a>.
            </p>
            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin:0 0 20px 0;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:700;color:#374151;">Tips for joining</p>
              <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#374151;">
                <li>Download or update the Zoom app before the session.</li>
                <li>Join 2&ndash;3 minutes early to test your audio.</li>
                <li>Your microphone will be muted by default; unmute when prompted to ask questions.</li>
              </ul>
            </div>
            <p style="margin:0 0 0 0;line-height:1.6;font-size:14px;color:#6b7280;">
              Questions before the event? Reach us at <a href="mailto:${support}" style="color:#2563eb;">${support}</a>.
            </p>
            <p style="margin:24px 0 0 0;line-height:1.5;">We look forward to seeing you there.<br /><br />Best regards,<br /><strong>The Community Health Media Team</strong></p>
            ${sponsor !== 'Community Health Media' ? `<p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">Sponsored by ${sponsor}.</p>` : ''}
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

function sanitizePlainDescription(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
