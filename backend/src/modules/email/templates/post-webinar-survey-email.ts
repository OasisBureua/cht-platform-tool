export type PostWebinarSurveyTemplateInput = {
  firstName: string;
  programTitle: string;
  /** Direct URL to the post-event Jotform survey. */
  surveyUrl: string;
  /** Link to the session page in the app (for reference). */
  appSessionUrl: string;
  supportEmail: string;
  sponsorName: string;
  /** Optional: honorarium amount in cents — include if survey completion drives payment eligibility. */
  honorariumCents?: number | null;
};

/**
 * Branded HTML + plain text sent to webinar attendees after the event to prompt survey completion.
 * Survey completion is required for payment eligibility; this is stated clearly when an honorarium applies.
 */
export function buildPostWebinarSurveyEmail(
  p: PostWebinarSurveyTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const survey = escape(p.surveyUrl.trim());

  const honorariumLine =
    p.honorariumCents && p.honorariumCents > 0
      ? formatHonorariumLine(p.honorariumCents)
      : null;

  const subject = `Action required: complete your post-event survey — ${p.programTitle}`;

  const text = [
    `Thank you, ${p.firstName.trim() || 'there'},`,
    '',
    `Thank you for attending "${p.programTitle}." We hope it was valuable.`,
    '',
    'Please take a few minutes to complete the short post-event survey. Your feedback is important to us and helps us improve future programming.',
    '',
    honorariumLine
      ? `Survey completion is required for honorarium processing (${honorariumLine.plain}). Completing the survey confirms your participation and starts the payment process.`
      : null,
    honorariumLine ? '' : null,
    'Complete the survey here:',
    p.surveyUrl,
    '',
    'You can also access the session page in the app for any additional steps:',
    p.appSessionUrl,
    '',
    `Questions? Contact us at ${p.supportEmail}.`,
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
            <p style="margin:0 0 16px 0;font-size:17px;line-height:1.5;">Thank you, <strong>${first}</strong>,</p>
            <p style="margin:0 0 16px 0;line-height:1.6;">
              Thank you for attending <strong>${title}</strong>. We hope the session was valuable.
            </p>
            <p style="margin:0 0 20px 0;line-height:1.6;">
              Please take a few minutes to complete the short post-event survey. Your feedback helps us improve future programming.
            </p>
            ${
              honorariumLine
                ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin:0 0 20px 0;">
                <p style="margin:0;line-height:1.6;font-size:14px;color:#14532d;">
                  <strong>Honorarium reminder:</strong> Survey completion is required to process your honorarium (${escape(honorariumLine.plain)}).
                  Completing the survey confirms your participation and starts the payment workflow.
                </p>
              </div>`
                : ''
            }
            <h2 style="margin:0 0 10px 0;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;">Complete your survey</h2>
            <p style="margin:0 0 16px 0;">
              <a href="${survey}" style="display:inline-block;background-color:#111827;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Take the survey</a>
            </p>
            <p style="margin:0 0 20px 0;font-size:13px;color:#6b7280;word-break:break-all;">
              <a href="${survey}" style="color:#4b5563;">${survey}</a>
            </p>
            <p style="margin:0 0 16px 0;line-height:1.6;font-size:14px;color:#374151;">
              You can also view any additional post-event steps on the
              <a href="${escape(p.appSessionUrl)}" style="color:#2563eb;">session page in the app</a>.
            </p>
            <p style="margin:20px 0 0 0;line-height:1.6;font-size:14px;color:#6b7280;">
              Questions? Contact us at <a href="mailto:${support}" style="color:#2563eb;">${support}</a>.
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

function formatHonorariumLine(honorariumCents: number): { plain: string } {
  const dollars = honorariumCents / 100;
  const formatted = dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
  return { plain: `${formatted} subject to eligibility and program policy` };
}
