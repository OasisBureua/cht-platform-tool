import { ProgramZoomSessionType } from '@prisma/client';
import {
  E,
  emailWrap,
  emailButton,
  emailWarnCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

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
  const first   = escape(p.firstName.trim() || 'there');
  const title   = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = 'Community Health Media';
  const note    = p.adminNote?.trim() ? escape(p.adminNote.trim()) : null;

  const typeLabel = p.sessionKind === ProgramZoomSessionType.MEETING
    ? 'CHM Office Hours'
    : 'live webinar';

  const { mainTextPlain, mainHtml } = p.reason === 'INCOMPLETE_INTAKE'
    ? {
        mainTextPlain: [
          'Your registration for this event could not be approved because the required registration or intake step was not completed, or required survey responses are missing or incomplete.',
          'Please return to the app, start registration again, and complete all required questions and any linked registration or survey forms. After you resubmit, your request can be reviewed again.',
          'Submitting a complete registration does not guarantee approval; availability and program requirements still apply.',
        ],
        mainHtml: `
          <p style="margin:0 0 12px;line-height:1.6;color:${E.BODY_TEXT}">Your registration could <strong>not</strong> be approved because the <strong>required registration or intake step was not completed</strong>, or required survey responses are missing or incomplete.</p>
          <p style="margin:0 0 12px;line-height:1.6;color:${E.BODY_TEXT}"><strong>Return to the app</strong>, start registration again, and complete all required questions and any linked forms. After you resubmit, your request can be reviewed again.</p>
          <p style="margin:0;line-height:1.6;font-size:13px;color:${E.MUTED}">Submitting a complete registration does not guarantee approval; availability and program requirements still apply.</p>`,
      }
    : {
        mainTextPlain: [
          'We are not able to approve your registration for this event at this time. This may be due to program capacity, eligibility, or internal review.',
          'If the program allows another registration, you may try again from the app; a new request will appear as pending for review.',
        ],
        mainHtml: `
          <p style="margin:0 0 12px;line-height:1.6;color:${E.BODY_TEXT}">We are <strong>not able to approve</strong> your registration for this event <strong>at this time</strong>. This may be due to program capacity, eligibility, or internal review.</p>
          <p style="margin:0;line-height:1.6;color:${E.BODY_TEXT}">If the program allows another registration, you may <strong>try again from the app</strong>; a new request will appear as pending for review.</p>`,
      };

  const subject = `Update on your registration — ${p.programTitle}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `This message is about: ${p.programTitle} (${typeLabel}).`,
    '',
    'Your current registration request has not been approved.',
    '',
    ...mainTextPlain,
    '',
    ...(note ? ['Note from the program team:', p.adminNote.trim(), ''] : []),
    'Open the session in the app (to register again or read details):',
    p.appSessionUrl,
    '',
    `If you have questions, contact us at ${p.supportEmail}.`,
    '',
    'Best regards,',
    'The Community Health Media Team',
  ].join('\n');

  // ── HTML ─────────────────────────────────────────────────────────────────────
  const noteHtml = note
    ? emailWarnCard(`
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${E.WARN_TEXT}">Note from the program team</p>
        <p style="margin:0;line-height:1.5;color:${E.WARN_TEXT}">${note}</p>
      `)
    : '';

  const body = `
    <p style="margin:0 0 6px;color:${E.BODY_TEXT};font-size:17px">Hi <strong>${first}</strong>,</p>
    <p style="margin:0 0 6px;color:${E.MUTED};font-size:14px;line-height:1.6">
      This is about: <strong style="color:${E.BODY_TEXT}">${title}</strong>
      <span style="color:${E.LABEL}"> (${escape(typeLabel)})</span>
    </p>
    <p style="margin:0 0 20px;color:${E.BODY_TEXT};font-size:15px;font-weight:600">
      Your current registration request has not been approved.
    </p>

    <div style="color:${E.BODY_TEXT};font-size:14px;line-height:1.6">${mainHtml}</div>

    ${noteHtml}

    <p style="margin:24px 0 12px;color:${E.MUTED};font-size:14px;line-height:1.6">
      Open the program in the app to register again or view full details:
    </p>
    ${emailButton(escape(p.appSessionUrl), 'Open in App')}
    ${emailUrlLine(escape(p.appSessionUrl))}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({ sponsorName: sponsor, subtitle: 'Registration Update', body });
  return { subject, text, html };
}
