import { buildReportReadyEmail } from './report-ready-email';

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const base = {
  reportsUrl:
    'https://devapp.communityhealth.media/admin/reports/campaigns/9?tab=reports',
  supportEmail: 'info@communityhealth.media',
};

describe('buildReportReadyEmail', () => {
  it('first report: plain subject, link to the Reports page, no attachment wording', () => {
    const { subject, text, html } = buildReportReadyEmail(
      { ...base, version: 1 },
      escape,
    );

    expect(subject).toBe('Your Executive Summary is ready');
    expect(text).toContain('The Executive Summary you requested is ready.');
    expect(text).toContain(base.reportsUrl);
    expect(html).toContain('Open Reports');
    expect(html).toContain(
      'href="https://devapp.communityhealth.media/admin/reports/campaigns/9?tab=reports"',
    );
    expect(html).toContain('Report Ready');
  });

  it('regenerated report names the version', () => {
    const { subject, text } = buildReportReadyEmail(
      { ...base, version: 3 },
      escape,
    );

    expect(subject).toBe('Your updated Executive Summary is ready (v3)');
    expect(text).toContain('(version 3)');
  });

  it('escapes the URL in HTML', () => {
    const { html } = buildReportReadyEmail(
      { ...base, version: 1, reportsUrl: 'https://x.test/a?b=1&c="2"' },
      escape,
    );

    expect(html).toContain('https://x.test/a?b=1&amp;c=&quot;2&quot;');
    expect(html).not.toContain('c="2"');
  });
});
