export type MissedWebinarTemplateInput = {
  firstName: string;
  programTitle: string;
  /** Optional short description surfaced in the body. */
  programDescription?: string | null;
  startDate: Date | null;
  /** Link to the platform home or upcoming-events page. */
  appHomeUrl: string;
  supportEmail: string;
  sponsorName: string;
};

/**
 * Branded HTML + plain text for users who registered but did not attend a webinar.
 * Sent after the post-event attendance check; must not move the user into payment eligibility.
 */
export function buildMissedWebinarEmail(
  p: MissedWebinarTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);

  const when = p.startDate
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York',
      }).format(p.startDate)
    : null;

  const descPlain = p.programDescription
    ? sanitizePlainDescription(p.programDescription).slice(0, 400)
    : null;

  const subject = `We missed you — ${p.programTitle}`;

  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `We noticed you were registered for "${p.programTitle}"${when ? ` on ${when}` : ''} but weren't able to make it.`,
    '',
    descPlain ? `About the session: ${descPlain}` : null,
    descPlain ? '' : null,
    'We understand schedules can be unpredictable. Keep an eye out for future CHM programming — we would love to see you at the next session.',
    '',
    'Visit the platform to see upcoming webinars and office hours:',
    p.appHomeUrl,
    '',
    `If you have any questions, reach out at ${p.supportEmail}.`,
    '',
    'Best regards,',
    'The Community Health Media Team',
    sponsor !== 'Community Health Media'
      ? `\nSponsored by ${p.sponsorName}.`
      : null,
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
              We noticed you were registered for <strong>${title}</strong>${when ? ` on <strong>${escape(when)}</strong>` : ''} but weren&apos;t able to make it.
            </p>
            ${
              descPlain
                ? `<p style="margin:0 0 16px 0;line-height:1.6;color:#374151;font-size:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">${escape(descPlain)}</p>`
                : ''
            }
            <p style="margin:0 0 16px 0;line-height:1.6;">
              We understand schedules can be unpredictable. Keep an eye out for future CHM programming &mdash; we would love to see you at the next session.
            </p>
            <p style="margin:0 0 20px 0;line-height:1.6;">Visit the platform to see upcoming webinars and office hours:</p>
            <p style="margin:0 0 8px 0;">
              <a href="${escape(p.appHomeUrl)}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">View upcoming events</a>
            </p>
            <p style="margin:20px 0 0 0;line-height:1.6;font-size:14px;color:#6b7280;">
              If you have any questions, contact us at <a href="mailto:${support}" style="color:#2563eb;">${support}</a>.
            </p>
            <p style="margin:24px 0 0 0;line-height:1.5;">Best regards,<br /><strong>The Community Health Media Team</strong></p>
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

function sanitizePlainDescription(s: string): string {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
