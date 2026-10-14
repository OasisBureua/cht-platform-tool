import { buildPublicRegistrationSurveyEmail } from './public-registration-survey-email';

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

describe('buildPublicRegistrationSurveyEmail', () => {
  const input = {
    firstName: 'Ana',
    programTitle: 'CHM User Test',
    surveyUrl: 'https://app.example/register/survey/tok',
    supportEmail: 'info@communityhealth.media',
    sponsorName: 'CHM',
  };

  it('links to the personal registration survey', () => {
    const { subject, text, html } = buildPublicRegistrationSurveyEmail(
      input,
      escape,
    );
    expect(subject).toBe('Complete your registration: CHM User Test');
    expect(text).toContain('https://app.example/register/survey/tok');
    expect(html).toContain('href="https://app.example/register/survey/tok"');
    expect(html).toContain('Complete the Survey');
  });

  it('escapes names and titles in the HTML', () => {
    const { html } = buildPublicRegistrationSurveyEmail(
      { ...input, firstName: '<b>x</b>', programTitle: 'A & B' },
      escape,
    );
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('A &amp; B');
  });
});
