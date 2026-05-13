import {
  E,
  emailWrap,
  emailButton,
  emailSupportLine,
} from './email-layout';

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
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);

  const when = p.startDate
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        timeZone: 'America/New_York',
      }).format(p.startDate)
    : null;

  const descPlain = p.programDescription
    ? sanitizePlainDescription(p.programDescription).slice(0, 400)
    : null;

  const subject = `We missed you — ${p.programTitle}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
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
    sponsor !== 'Community Health Media' ? `\nSponsored by ${p.sponsorName}.` : null,
  ]
    .filter((line) => line != null)
    .join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const descHtml = descPlain
    ? `<div style="background:#f9fafb;border:1px solid ${E.BORDER};border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${E.MUTED}">${escape(descPlain)}</p>
      </div>`
    : '';

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${first}</strong>,</p>
    <p style="margin:0 0 16px;color:${E.MUTED};font-size:15px;line-height:1.6">
      We noticed you were registered for <strong style="color:${E.BODY_TEXT}">${title}</strong>${
        when ? ` on <strong style="color:${E.BODY_TEXT}">${escape(when)}</strong>` : ''
      } but weren&apos;t able to make it.
    </p>

    ${descHtml}

    <p style="margin:0 0 20px;color:${E.MUTED};font-size:14px;line-height:1.6">
      We understand schedules can be unpredictable. Keep an eye out for future CHM programming &mdash; we would love to see you at the next session.
    </p>

    <p style="margin:0 0 14px;color:${E.MUTED};font-size:14px">
      Visit the platform to see upcoming webinars and office hours:
    </p>
    ${emailButton(escape(p.appHomeUrl), 'View Upcoming Events')}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'We Missed You', body });
  return { subject, text, html };
}

function sanitizePlainDescription(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
