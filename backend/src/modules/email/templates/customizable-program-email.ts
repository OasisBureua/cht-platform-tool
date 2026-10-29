import { ProgramEmailKind } from '@prisma/client';
import {
  applyMergeTokens,
  PROGRAM_EMAIL_KIND_META,
  type ProgramEmailCopy,
  type ProgramEmailMergeContext,
} from '../program-email-defaults';
import {
  E,
  emailButton,
  emailSupportLine,
  emailUrlLine,
  emailWrap,
} from './email-layout';

export type CustomizableEmailLinks = {
  sessionLink?: string | null;
  joinLink?: string | null;
  surveyLink?: string | null;
  homeLink?: string | null;
  paymentsLink?: string | null;
  supportEmail: string;
};

/**
 * Build subject/text/html from editable copy + locked required link + CHM chrome.
 * Merge tokens are applied before HTML escaping.
 */
export function buildCustomizableProgramEmail(opts: {
  kind: ProgramEmailKind;
  copy: ProgramEmailCopy;
  merge: ProgramEmailMergeContext;
  links: CustomizableEmailLinks;
  escape: (s: string) => string;
  /** Optional date line already merged into copy; used only for subtitle. */
  subtitle?: string;
}): { subject: string; text: string; html: string } {
  const meta = PROGRAM_EMAIL_KIND_META[opts.kind];
  const subject = applyMergeTokens(opts.copy.subject, opts.merge).trim();
  const greeting = applyMergeTokens(opts.copy.greeting, opts.merge).trim();
  const body = applyMergeTokens(opts.copy.body, opts.merge).trim();
  const signOff = applyMergeTokens(opts.copy.signOff, opts.merge).trim();

  const escape = opts.escape;
  const support = escape(opts.links.supportEmail);

  const locked = lockedLinkBlock(meta.requiredLink, opts.links, escape);

  const textParts = [
    greeting,
    '',
    body,
    '',
    locked.textLabel,
    locked.textUrl,
    '',
    signOff,
    '',
    `Questions? Reply to ${opts.links.supportEmail}.`,
  ].filter((line) => line !== undefined);

  const bodyHtml = `
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">${escape(greeting)}</p>
      ${body
        .split(/\n{2,}/)
        .map(
          (para) =>
            `<p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">${escape(para).replace(/\n/g, '<br>')}</p>`,
        )
        .join('')}
      ${locked.html}
      <p style="margin:24px 0 0;color:${E.BODY_TEXT};font-size:15px;line-height:1.55;white-space:pre-line">${escape(signOff)}</p>
      ${emailSupportLine(support)}
    `;

  const html = emailWrap({
    sponsorName: opts.merge.sponsorName || 'Community Health Media',
    subtitle: opts.subtitle ?? meta.label,
    body: bodyHtml,
  });

  return {
    subject: subject || meta.defaultCopy.subject,
    text: textParts.join('\n'),
    html,
  };
}

function lockedLinkBlock(
  required: (typeof PROGRAM_EMAIL_KIND_META)[ProgramEmailKind]['requiredLink'],
  links: CustomizableEmailLinks,
  escape: (s: string) => string,
): { html: string; textLabel: string; textUrl: string } {
  const pick = (): { href: string; label: string } | null => {
    switch (required) {
      case 'session':
        return links.sessionLink
          ? { href: links.sessionLink, label: 'Open session page' }
          : null;
      case 'join':
        return links.joinLink
          ? { href: links.joinLink, label: 'Join session' }
          : links.sessionLink
            ? { href: links.sessionLink, label: 'Open session page' }
            : null;
      case 'survey':
        return links.surveyLink
          ? { href: links.surveyLink, label: 'Complete survey' }
          : links.sessionLink
            ? { href: links.sessionLink, label: 'Open session page' }
            : null;
      case 'home':
        return links.homeLink
          ? { href: links.homeLink, label: 'Browse upcoming sessions' }
          : null;
      case 'payments':
        return links.paymentsLink
          ? { href: links.paymentsLink, label: 'Open profile & payments' }
          : null;
      default:
        return null;
    }
  };

  const cta = pick();
  if (!cta) {
    return { html: '', textLabel: '', textUrl: '' };
  }
  const urlEsc = escape(cta.href);
  return {
    html: `
      <div style="margin:8px 0 16px">${emailButton(cta.href, cta.label)}</div>
      ${emailUrlLine(urlEsc)}
    `,
    textLabel: cta.label + ':',
    textUrl: cta.href,
  };
}
