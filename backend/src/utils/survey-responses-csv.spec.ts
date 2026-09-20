import {
  UTF8_CSV_BOM,
  buildSurveyResponsesCsv,
  normalizeCsvText,
  surveyResponsesCsvFilename,
} from './survey-responses-csv';

describe('survey-responses-csv', () => {
  it('builds CSV with question prompts as headers and a UTF-8 BOM', () => {
    const csv = buildSurveyResponsesCsv({
      surveyTitle: 'Post Event',
      surveyType: 'FEEDBACK',
      questionsSchema: {
        sections: [
          {
            questions: [
              { id: 'npi', prompt: 'NPI number' },
              { id: 'rating', prompt: 'Overall rating' },
            ],
          },
        ],
      },
      responses: [
        {
          submittedAt: '2026-07-10T12:00:00.000Z',
          schemaVersion: 2,
          answers: { npi: '1234567890', rating: 'Excellent' },
          user: {
            email: 'doc@example.com',
            firstName: 'Jane',
            lastName: 'Doe',
            specialty: 'Cardiology',
          },
          registration: {
            status: 'APPROVED',
            postEventAttendanceStatus: 'VERIFIED',
          },
        },
      ],
    });

    expect(csv.startsWith(UTF8_CSV_BOM)).toBe(true);
    expect(csv).toContain(
      'first_name,last_name,email,specialty,registration_status,attendance_status,submitted_at,schema_version,NPI number,Overall rating',
    );
    expect(csv).toContain(
      'Jane,Doe,doc@example.com,Cardiology,APPROVED,VERIFIED,2026-07-10T12:00:00.000Z,2,1234567890,Excellent',
    );
  });

  it('escapes commas and quotes in cell values', () => {
    const csv = buildSurveyResponsesCsv({
      surveyTitle: 'Intake',
      surveyType: 'INTAKE',
      questionsSchema: { sections: [{ questions: [{ id: 'q1', prompt: 'Notes' }] }] },
      responses: [
        {
          submittedAt: '2026-07-10T12:00:00.000Z',
          answers: { q1: 'Says "yes", maybe' },
          user: {
            email: 'a@b.com',
            firstName: 'A',
            lastName: 'B',
          },
          registration: { status: 'PENDING' },
        },
      ],
    });

    expect(csv).toContain('"Says ""yes"", maybe"');
  });

  it('normalizes en/em dashes so Excel does not show mojibake', () => {
    expect(normalizeCsvText('6–10')).toBe('6-10');
    expect(normalizeCsvText('11—20')).toBe('11-20');
    expect(normalizeCsvText('0–10')).toBe('0-10');

    const csv = buildSurveyResponsesCsv({
      surveyTitle: 'Intake',
      surveyType: 'INTAKE',
      questionsSchema: {
        sections: [
          {
            questions: [
              { id: 'years', prompt: 'Years in independent clinical practice' },
            ],
          },
        ],
      },
      responses: [
        {
          submittedAt: '2026-07-10T12:00:00.000Z',
          answers: { years: '6–10' },
          user: {
            email: 'a@b.com',
            firstName: 'A',
            lastName: 'B',
          },
          registration: { status: 'APPROVED' },
        },
      ],
    });

    expect(csv).toContain('6-10');
    expect(csv).not.toContain('–');
    expect(csv).not.toContain('â€“');
  });

  it('builds a program-prefixed filename', () => {
    expect(surveyResponsesCsvFilename('Program 1', 'INTAKE')).toBe(
      'program-1-registration-responses.csv',
    );
    expect(surveyResponsesCsvFilename('Program 1', 'FEEDBACK')).toBe(
      'program-1-post-event-responses.csv',
    );
  });
});
