import {
  E,
  emailWrap,
  emailButton,
  emailSuccessCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type PostWebinarSurveyTemplateInput = {
  firstName: string;
  programTitle: string;
  /** Direct URL to the post-event Jotform survey. Omit to fall back to the app session page CTA. */
  surveyUrl?: string | null;
  /** Link to the session page in the app. Used as fallback CTA when surveyUrl is absent. */
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
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = escape(p.sponsorName);
  const ctaUrl  = p.surveyUrl?.trim() ? escape(p.surveyUrl.trim()) : escape(p.appSessionUrl);
  const hasSurveyLink = Boolean(p.surveyUrl?.trim());

  const honorariumLine = p.honorariumCents && p.honorariumCents > 0
    ? formatHonorariumLine(p.honorariumCents)
    : null;

  const subject = `Action required: complete your post-event survey — ${p.programTitle}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
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
    hasSurveyLink ? 'Complete the survey here:' : 'Access your session page to complete the survey:',
    hasSurveyLink ? (p.surveyUrl as string) : p.appSessionUrl,
    '',
    hasSurveyLink ? `You can also view your session details in the app:\n${p.appSessionUrl}\n` : null,
    `Questions? Contact us at ${p.supportEmail}.`,
    '',
    'Best regards,',
    'The Community Health Media Team',
    sponsor !== 'Community Health Media' ? `\nSponsored by ${p.sponsorName}.` : null,
  ]
    .filter((line) => line != null)
    .join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const honorariumHtml = honorariumLine
    ? emailSuccessCard(`
        <p style="margin:0;line-height:1.6;font-size:13px;color:${E.SUCCESS_TEXT}">
          <strong>Honorarium reminder:</strong> Survey completion is required to process your honorarium
          (${escape(honorariumLine.plain)}). Completing the survey confirms your participation and starts the payment workflow.
        </p>
      `)
    : '';

  const ctaLabel = hasSurveyLink ? 'Take the Survey' : 'View Session Page';

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Thank you, <strong>${first}</strong>!</p>
    <p style="margin:0 0 16px;color:${E.MUTED};font-size:15px;line-height:1.6">
      Thank you for attending <strong style="color:${E.BODY_TEXT}">${title}</strong>. We hope the session was valuable.
    </p>
    <p style="margin:0 0 20px;color:${E.MUTED};font-size:14px;line-height:1.6">
      Please take a few minutes to complete the short post-event survey. Your feedback helps us improve future programming.
    </p>

    ${honorariumHtml}

    <p style="margin:${honorariumHtml ? '20px' : '0'} 0 14px;color:${E.MUTED};font-size:14px;line-height:1.6">
      <strong style="color:${E.BODY_TEXT}">${hasSurveyLink ? 'Complete your survey' : 'Access your session page to complete the survey'}</strong>
    </p>
    ${emailButton(ctaUrl, ctaLabel)}
    ${emailUrlLine(ctaUrl)}

    ${hasSurveyLink ? `
    <p style="margin:20px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6">
      You can also view any additional post-event steps on the
      <a href="${escape(p.appSessionUrl)}" style="color:${E.LINK}">session page in the app</a>.
    </p>` : ''}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'Post-Event Survey', body });
  return { subject, text, html };
}

function formatHonorariumLine(honorariumCents: number): { plain: string } {
  const dollars = honorariumCents / 100;
  const formatted = dollars.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  return { plain: `${formatted} subject to eligibility and program policy` };
}
