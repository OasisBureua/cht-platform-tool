import { effectiveWebinarIntakeFormUrl } from './webinar-intake-url';

describe('effectiveWebinarIntakeFormUrl', () => {
  const defaultUrl = 'https://communityhealthmedia.jotform.com/default-intake';

  it('uses per-program URL for webinars when set', () => {
    expect(
      effectiveWebinarIntakeFormUrl(
        'WEBINAR',
        ' https://custom.jotform.com/abc ',
        defaultUrl,
      ),
    ).toBe('https://custom.jotform.com/abc');
  });

  it('falls back to env default for webinars without per-program URL', () => {
    expect(
      effectiveWebinarIntakeFormUrl('WEBINAR', null, defaultUrl),
    ).toBe(defaultUrl);
    expect(
      effectiveWebinarIntakeFormUrl('WEBINAR', '  ', defaultUrl),
    ).toBe(defaultUrl);
  });

  it('does not use env default for office hours meetings', () => {
    expect(
      effectiveWebinarIntakeFormUrl('MEETING', null, defaultUrl),
    ).toBeUndefined();
    expect(
      effectiveWebinarIntakeFormUrl(
        'MEETING',
        ' https://office-hours.jotform.com/x ',
        defaultUrl,
      ),
    ).toBe('https://office-hours.jotform.com/x');
  });

  it('returns per-program URL for unknown session types', () => {
    expect(
      effectiveWebinarIntakeFormUrl('OTHER', ' https://x.jotform.com/y ', defaultUrl),
    ).toBe('https://x.jotform.com/y');
  });
});
