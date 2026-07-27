import { ProgramZoomSessionType } from '@prisma/client';
import { E, emailWrap, emailButton, emailSupportLine } from './email-layout';

export type RegistrationSubmittedTemplateInput = {
  firstName: string;
  programTitle: string;
  requiresApproval: boolean;
  sessionKind: ProgramZoomSessionType;
  appSessionUrl: string;
  supportEmail: string;
};

/** Learner finished the registration wizard (pending admin review or auto-enrolled). */
export function buildRegistrationSubmittedEmail(
  p: RegistrationSubmittedTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const url = escape(p.appSessionUrl);

  const pendingCopy = p.requiresApproval
    ? 'Your registration is pending review. An administrator will approve or deny your request. We will email you when there is an update.'
    : 'You are registered for this session. Open the session page below for join details and next steps.';

  const subject = p.requiresApproval
    ? `Registration received, ${p.programTitle}`
    : `You are registered, ${p.programTitle}`;

  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `Thank you for registering for ${p.programTitle}.`,
    '',
    pendingCopy,
    '',
    p.appSessionUrl,
    '',
    `Questions? Reply to ${p.supportEmail}.`,
  ].join('\n');

  const body = `
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">Hi ${first},</p>
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">
        Thank you for registering for <strong>${title}</strong>.
      </p>
      <p style="margin:0 0 20px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">${escape(pendingCopy)}</p>
      ${emailButton(p.appSessionUrl, 'Open session page')}
      <p style="margin:20px 0 0;color:${E.MUTED};font-size:13px;line-height:1.5">
        Or copy this link: <a href="${url}" style="color:${E.LINK}">${url}</a>
      </p>
      ${emailSupportLine(support)}
    `;

  const html = emailWrap({
    sponsorName: 'Community Health Media',
    subtitle: p.requiresApproval ? 'Registration received' : 'You are registered',
    body,
  });

  return { subject, text, html };
}
