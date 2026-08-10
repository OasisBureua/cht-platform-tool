import { E, emailWrap, emailSupportLine } from './email-layout';

export type OperationalEmailTemplateInput = {
  subject: string;
  textBody: string;
  programTitle?: string;
  supportEmail: string;
};

/**
 * Freeform admin operational email: plain body wrapped in CHM chrome.
 */
export function buildOperationalEmail(
  p: OperationalEmailTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const subject = p.subject.trim();
  const bodyText = p.textBody.trim();
  const support = escape(p.supportEmail);
  const programLine = p.programTitle?.trim()
    ? `Program: ${p.programTitle.trim()}`
    : null;

  const text = [
    bodyText,
    '',
    ...(programLine ? [programLine, ''] : []),
    `Questions? Reply to this email or reach us at ${p.supportEmail}.`,
  ].join('\n');

  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withBreaks = escape(block).replace(/\n/g, '<br/>');
      return `<p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">${withBreaks}</p>`;
    })
    .join('');

  const programHtml = p.programTitle?.trim()
    ? `<p style="margin:0 0 16px;color:${E.MUTED};font-size:13px;line-height:1.5">Regarding: <strong style="color:${E.BODY_TEXT}">${escape(p.programTitle.trim())}</strong></p>`
    : '';

  const body = `
      ${programHtml}
      ${paragraphs || `<p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55"></p>`}
      ${emailSupportLine(support)}
  `;

  const html = emailWrap({
    sponsorName: 'Community Health Media',
    subtitle: 'Platform notice',
    body,
  });

  return { subject, text, html };
}
