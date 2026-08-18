import { ProgramZoomSessionType } from '@prisma/client';
import {
  E,
  emailWrap,
  emailButton,
  emailWarnCard,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type RegistrationRevokedTemplateInput = {
  firstName: string;
  programTitle: string;
  sessionKind: ProgramZoomSessionType;
  /** Optional free-text from admin explaining the revocation. */
  adminNote: string;
  appSessionUrl: string;
  supportEmail: string;
};

/**
 * Sent when an admin removes an approved learner from a program. The
 * registration is reset to REJECTED so the learner may register again; the
 * email tells them their access has been rescinded and how to reapply.
 */
export function buildRegistrationRevokedEmail(
  p: RegistrationRevokedTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const first = escape(p.firstName.trim() || 'there');
  const title = escape(p.programTitle);
  const support = escape(p.supportEmail);
  const sponsor = 'Community Health Media';
  const note = p.adminNote?.trim() ? escape(p.adminNote.trim()) : null;

  const typeLabel =
    p.sessionKind === ProgramZoomSessionType.MEETING
      ? 'CHM Office Hours'
      : 'live webinar';

  const subject = `Registration rescinded: ${p.programTitle}`;

  // ── Plain text ───────────────────────────────────────────────────────────────
  const text = [
    `Hi ${p.firstName.trim() || 'there'},`,
    '',
    `This message is about: ${p.programTitle} (${typeLabel}).`,
    '',
    'Your approval to attend this event has been rescinded by an administrator.',
    '',
    'You are no longer registered for this session. If you believe this was in error, or if you would like to attempt to register again, you may do so from the app.',
    '',
    ...(note ? ['Note from the program team:', p.adminNote.trim(), ''] : []),
    'Open the session in the app:',
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
      Your approval to attend has been rescinded.
    </p>

    <div style="color:${E.BODY_TEXT};font-size:14px;line-height:1.6">
      <p style="margin:0 0 12px;line-height:1.6;color:${E.BODY_TEXT}">You are <strong>no longer registered</strong> for this session. If you believe this was in error, or if you would like to attempt to register again, you may do so from the app.</p>
    </div>

    ${noteHtml}

    <p style="margin:24px 0 12px;color:${E.MUTED};font-size:14px;line-height:1.6">
      Open the program in the app:
    </p>
    ${emailButton(escape(p.appSessionUrl), 'Open in App')}
    ${emailUrlLine(escape(p.appSessionUrl))}

    ${emailSupportLine(support)}
  `;

  const html = emailWrap({
    sponsorName: sponsor,
    subtitle: 'Registration Rescinded',
    body,
  });
  return { subject, text, html };
}
