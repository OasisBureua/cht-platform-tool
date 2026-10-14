import {
  E,
  emailWrap,
  emailButton,
  emailSupportLine,
  emailUrlLine,
} from './email-layout';

export type ReportReadyTemplateInput = {
  /** 1 for the first report, 2+ after Regenerate. */
  version: number;
  /** Admin Reports page for the campaign (sign-in required; no attachment). */
  reportsUrl: string;
  supportEmail: string;
};

/**
 * Executive Summary is ready (CPR-35). Sent to the report's notify list once
 * per version, when cht-reports finishes a generation. Links to the Reports
 * page instead of attaching the PDF, so the report stays behind sign-in.
 */
export function buildReportReadyEmail(
  p: ReportReadyTemplateInput,
  escape: (s: string) => string,
): { subject: string; text: string; html: string } {
  const regenerated = p.version > 1;
  const subject = regenerated
    ? `Your updated Executive Summary is ready (v${p.version})`
    : 'Your Executive Summary is ready';
  const lead = regenerated
    ? `The updated Executive Summary you requested (version ${p.version}) is ready.`
    : 'The Executive Summary you requested is ready.';
  const url = escape(p.reportsUrl);
  const support = escape(p.supportEmail);

  const text = [
    lead,
    '',
    'Open the Reports page to download it:',
    p.reportsUrl,
    '',
    `Questions? Reply to this email or reach us at ${p.supportEmail}.`,
  ].join('\n');

  const body = `
      <p style="margin:0 0 16px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">
        ${escape(lead)}
      </p>
      <p style="margin:0 0 20px;color:${E.BODY_TEXT};font-size:15px;line-height:1.55">
        Open the Reports page to download it.
      </p>
      ${emailButton(url, 'Open Reports')}
      ${emailUrlLine(url)}
      ${emailSupportLine(support)}
    `;

  const html = emailWrap({
    sponsorName: 'Community Health Media',
    subtitle: 'Report Ready',
    body,
  });

  return { subject, text, html };
}
