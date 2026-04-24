import { ProgramZoomSessionType } from '@prisma/client';

export type RejectionEmailReason = 'GENERIC' | 'INCOMPLETE_INTAKE';

export type RegistrationRejectedTemplateInput = {
  firstName: string;
  programTitle: string;
  sessionKind: ProgramZoomSessionType;
  reason: RejectionEmailReason;
  /** Optional free-text from admin; shown in its own block if non-empty. */
  adminNote: string;
  appSessionUrl: string;
  supportEmail: string;
};

export function buildRegistrationRejectedEmail(
  p: RegistrationRejectedTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const note = p.adminNote?.trim() ? escape(p.adminNote.trim()) : null;

  const typeLabel =
    p.sessionKind === ProgramZoomSessionType.MEETING ? 'CHM Office Hours' : 'live webinar';

  const { mainTextPlain, mainHtml } =
    p.reason === 'INCOMPLETE_INTAKE'
      ? {
          mainTextPlain: [
            'Your registration for this event could not be approved because the required registration or intake step was not completed, or required survey responses are missing or incomplete.',
            'Please return to the app, start registration again, and complete all required questions and any linked registration or survey forms. After you resubmit, your request can be reviewed again.',
            'Submitting a complete registration does not guarantee approval; availability and program requirements still apply.',
          ],
          mainHtml: `<p style="margin:0 0 12px 0;line-height:1.6;">Your registration for this event could <strong>not</strong> be approved because the <strong>required registration or intake step was not completed</strong>, or <strong>required survey responses are missing or incomplete</strong>.</p>
<p style="margin:0 0 12px 0;line-height:1.6;">Please <strong>return to the app</strong>, <strong>start registration again</strong>, and <strong>complete all required questions</strong> and any linked registration or survey forms. After you resubmit, your request can be reviewed again.</p>
<p style="margin:0;line-height:1.6;font-size:14px;color:#4b5563;">Submitting a complete registration does not guarantee approval; availability and program requirements still apply.</p>`,
        }
      : {
          mainTextPlain: [
            'We are not able to approve your registration for this event at this time. This may be due to program capacity, eligibility, or internal review.',
            'If the program allows another registration, you may try again from the app; a new request will appear as pending for review.',
          ],
          mainHtml: `<p style="margin:0 0 12px 0;line-height:1.6;">We are <strong>not able to approve</strong> your registration for this event <strong>at this time</strong>. This may be due to program capacity, eligibility, or internal review.</p>
<p style="margin:0;line-height:1.6;">If the program allows another registration, you may <strong>try again from the app</strong>; a new request will appear as <strong>pending</strong> for review.</p>`,
        };

  const subject = `Update on your registration — ${p.programTitle}`;

  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `This message is about: ${p.programTitle} (${typeLabel}).`,
    '',
    'Your current registration request has not been approved.',
    '',
    ...mainTextPlain,
    '',
    ...(note
      ? ['Note from the program team:', p.adminNote!.trim(), '']
      : []),
    'Open the session in the app (to register again or read details):',
    p.appSessionUrl,
    '',
    'If you have questions, contact us at ' + p.supportEmail + '.',
    '',
    'Best regards,',
    'The Community Health Media Team',
  ].join('\n');

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
          <td style="padding:28px 28px 8px 28px;border-top:4px solid #9ca3af;">
            <p style="margin:0 0 8px 0;font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Registration update</p>
            <p style="margin:0 0 16px 0;font-size:17px;line-height:1.5;">Hi ${first},</p>
            <p style="margin:0 0 8px 0;line-height:1.6;">This is about: <strong>${title}</strong> <span style="color:#6b7280;">(${escape(typeLabel)})</span>.</p>
            <p style="margin:0 0 20px 0;line-height:1.6;">Your <strong>current registration request has not been approved</strong>.</p>
            ${mainHtml}
            ${
              note
                ? `<div style="margin:20px 0;padding:14px 16px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;">
              <p style="margin:0 0 6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#92400e;">Note from the program team</p>
              <p style="margin:0;line-height:1.5;color:#78350f;">${note}</p>
            </div>`
                : ''
            }
            <p style="margin:22px 0 12px 0;line-height:1.6;">You can open the program in the app to register again or read full details:</p>
            <p style="margin:0 0 8px 0;">
              <a href="${escape(p.appSessionUrl)}" style="display:inline-block;background-color:#374151;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;">Open in the app</a>
            </p>
            <p style="margin:0;font-size:13px;color:#6b7280;word-break:break-all;">
              <a href="${escape(p.appSessionUrl)}" style="color:#4b5563;">${escape(p.appSessionUrl)}</a>
            </p>
            <p style="margin:24px 0 0 0;line-height:1.6;">If you have questions, contact us at <a href="mailto:${support}" style="color:#2563eb;">${support}</a>.</p>
            <p style="margin:20px 0 0 0;line-height:1.5;">Best regards,<br /><strong>The Community Health Media Team</strong></p>
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
