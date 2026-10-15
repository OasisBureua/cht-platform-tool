import {
  E,
  emailWrap,
  emailButton,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type PublicRegistrationSurveyTemplateInput = {
  firstName: string;
  programTitle: string;
  /** Personal link to the program's registration survey (no login). */
  surveyUrl: string;
  supportEmail: string;
  sponsorName: string;
};

/**
 * Sent when someone registers through a program's public registration page:
 * their personal link to the registration survey. The link works without an
 * account; it is tied to this registration only.
 */
export function buildPublicRegistrationSurveyEmail(
  p: PublicRegistrationSurveyTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const firstName = p.firstName.trim() || 'there';
  const subject = `Complete your registration: ${p.programTitle}`;

  const text = [
    `Hi ${firstName},`,
    '',
    `Thanks for registering for "${p.programTitle}."`,
    '',
    'Please complete the short registration survey to finish your registration:',
    p.surveyUrl,
    '',
    'This link is personal to you. Please do not forward it.',
    '',
    `Questions? Contact us at ${p.supportEmail}.`,
    '',
    'Best regards,',
    'The Community Health Media Team',
  ].join('\n');

  const url = escape(p.surveyUrl);
  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${escape(firstName)}</strong>,</p>
    <p style="margin:0 0 16px;color:${E.MUTED};font-size:15px;line-height:1.6">
      Thanks for registering for <strong style="color:${E.BODY_TEXT}">${escape(p.programTitle)}</strong>.
    </p>
    <p style="margin:0 0 20px;color:${E.MUTED};font-size:14px;line-height:1.6">
      Please complete the short registration survey to finish your registration.
    </p>
    ${emailButton(url, 'Complete the Survey')}
    ${emailUrlLine(url)}
    <p style="margin:20px 0 0;color:${E.MUTED};font-size:13px;line-height:1.6">
      This link is personal to you. Please do not forward it.
    </p>
    ${emailSupportLine(escape(p.supportEmail))}
  `;

  const html = emailWrap({
    sponsorName: escape(p.sponsorName),
    subtitle: 'Registration Survey',
    body,
  });
  return { subject, text, html };
}
