import { E, emailWrap, emailButton, emailSupportLine } from './email-layout';

export type RegistrationInviteTemplateInput = {
  firstName: string;
  programTitles: string[];
  registerUrl: string;
  supportEmail: string;
};

export function buildRegistrationInviteEmail(
  p: RegistrationInviteTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const support = escape(p.supportEmail);
  const url = escape(p.registerUrl);
  const count = p.programTitles.length;
  const subject =
    count === 1
      ? `Register for: ${p.programTitles[0]}`
      : `Register for ${count} upcoming live sessions`;

  const listText = p.programTitles.map((t) => `• ${t}`).join('\n');
  const listHtml = p.programTitles
    .map((t) => `<li style="margin:0 0 6px">${escape(t)}</li>`)
    .join('');

  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    count === 1
      ? 'You are invited to register for the following live session on Community Health Technologies:'
      : 'You are invited to register for the following live sessions on Community Health Technologies:',
    '',
    listText,
    '',
    `Open the registration page to select sessions and complete intake (if required):`,
    p.registerUrl,
    '',
    `Questions? Reply to ${p.supportEmail}.`,
  ].join('\n');

  const body = `
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">
        Hi ${first},
      </p>
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">
        ${
          count === 1
            ? 'You are invited to register for the following live session:'
            : 'You are invited to register for the following live sessions:'
        }
      </p>
      <ul style="margin:0 0 20px;padding-left:20px;color:${E.BODY_TEXT};font-size:14px;line-height:1.5">
        ${listHtml}
      </ul>
      ${emailButton(url, 'Open registration page')}
      <p style="margin:20px 0 0;color:${E.MUTED};font-size:13px;line-height:1.5">
        Or copy this link: <a href="${url}" style="color:${E.LINK}">${url}</a>
      </p>
      ${emailSupportLine(support)}
    `;

  const html = emailWrap({
    sponsorName: 'Community Health Media',
    subtitle: 'Registration Invite',
    body,
  });

  return { subject, text, html };
}
