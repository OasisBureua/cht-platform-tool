import { ProgramEmailKind } from '@prisma/client';
import {
  applyMergeTokens,
  defaultCopyFor,
  findUnknownTokens,
  listProgramEmailKinds,
} from './program-email-defaults';
import { buildCustomizableProgramEmail } from './templates/customizable-program-email';

describe('program email defaults + customizable renderer', () => {
  it('exposes six customizable kinds', () => {
    expect(listProgramEmailKinds()).toHaveLength(6);
  });

  it('rejects unknown merge tokens', () => {
    expect(
      findUnknownTokens({
        subject: 'Hello {{firstName}} {{evilToken}}',
        body: 'See {{eventTitle}}',
      }),
    ).toEqual(['evilToken']);
  });

  it('applies merge tokens', () => {
    expect(
      applyMergeTokens('Hi {{firstName}} — {{eventTitle}}', {
        firstName: 'Alex',
        eventTitle: 'Beta Webinar',
      }),
    ).toBe('Hi Alex — Beta Webinar');
  });

  it('builds HTML with locked CTA and escaped body', () => {
    const copy = defaultCopyFor(ProgramEmailKind.POST_WEBINAR_SURVEY);
    const { subject, html, text } = buildCustomizableProgramEmail({
      kind: ProgramEmailKind.POST_WEBINAR_SURVEY,
      copy,
      merge: {
        firstName: 'Alex',
        eventTitle: 'Beta <Webinar>',
        honorariumAmount: '$200',
        eventDate: ' on Monday',
      },
      links: {
        surveyLink: 'https://app.example/surveys/1',
        supportEmail: 'info@example.com',
      },
      escape: (s) =>
        s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;'),
    });
    expect(subject).toContain('Beta <Webinar>');
    expect(html).toContain('Beta &lt;Webinar&gt;');
    expect(html).toContain('Complete survey');
    expect(html).toContain('https://app.example/surveys/1');
    expect(text).toContain('Alex');
  });
});
