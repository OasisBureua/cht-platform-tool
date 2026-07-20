import {
  buildSurveyResponseAnalytics,
  type BuildSurveyAnalyticsInput,
  type ChoiceQuestionAnalytics,
  type RatingQuestionAnalytics,
  type TextQuestionAnalytics,
} from './survey-analytics';
import { stripIdentityFieldsFromSurveyAnswers } from './survey-answer-sanitizer';

const nativeSchema = {
  sections: [
    {
      id: 's1',
      questions: [
        {
          id: 'role',
          type: 'single_choice',
          prompt: 'Your role?',
          options: ['MD', 'NP', 'PA'],
          required: true,
        },
        {
          id: 'topics',
          type: 'multi_choice',
          prompt: 'Topics of interest',
          options: ['A', 'B', 'C'],
          maxSelections: 2,
        },
        {
          id: 'confidence',
          type: 'rating',
          prompt: 'Confidence (1-5)',
        },
        {
          id: 'comments',
          type: 'long_text',
          prompt: 'Anything else?',
        },
        { id: 'intro', type: 'info', prompt: 'Welcome' },
      ],
    },
  ],
};

function build(overrides: Partial<BuildSurveyAnalyticsInput> = {}) {
  const input: BuildSurveyAnalyticsInput = {
    surveyType: 'FEEDBACK',
    questionsSchema: nativeSchema,
    responses: [
      {
        submittedAt: '2026-07-10T09:00:00.000Z',
        userId: 'u1',
        answers: {
          role: 'MD',
          topics: ['A', 'B'],
          confidence: 4,
          comments: 'Great session, thanks!',
        },
      },
      {
        submittedAt: '2026-07-10T15:30:00.000Z',
        userId: 'u2',
        answers: {
          role: 'NP',
          topics: ['A'],
          confidence: 5,
          comments: 'Great session, thanks!',
        },
      },
      {
        submittedAt: '2026-07-11T11:00:00.000Z',
        userId: 'u3',
        answers: {
          role: 'MD',
          topics: ['B', 'C'],
          confidence: 2,
          comments: 'Reach me at jane@example.com or 415-555-1212',
        },
      },
    ],
    ...overrides,
  };
  return buildSurveyResponseAnalytics(input);
}

function q<T>(result: ReturnType<typeof build>, id: string): T {
  const found = result.questions.find((x) => x.id === id);
  if (!found) throw new Error(`question ${id} not found`);
  return found as T;
}

describe('buildSurveyResponseAnalytics', () => {
  describe('totals', () => {
    it('counts responses, unique respondents, and first/last', () => {
      const r = build();
      expect(r.totals.totalResponses).toBe(3);
      expect(r.totals.uniqueRespondents).toBe(3);
      expect(r.totals.firstResponseAt).toBe('2026-07-10T09:00:00.000Z');
      expect(r.totals.lastResponseAt).toBe('2026-07-11T11:00:00.000Z');
    });

    it('dedupes repeat respondents and counts anonymous rows individually', () => {
      const r = build({
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: { role: 'MD' },
          },
          {
            submittedAt: '2026-07-10T10:00:00.000Z',
            userId: 'u1',
            answers: { role: 'NP' },
          },
          {
            submittedAt: '2026-07-10T11:00:00.000Z',
            userId: null,
            answers: { role: 'PA' },
          },
          { submittedAt: '2026-07-10T12:00:00.000Z', answers: { role: 'PA' } },
        ],
      });
      expect(r.totals.totalResponses).toBe(4);
      // u1 (once) + 2 anonymous = 3
      expect(r.totals.uniqueRespondents).toBe(3);
    });

    it('computes completion rate only when eligibleCount is provided', () => {
      expect(build().totals.completionRate).toBeNull();
      const r = build({ eligibleCount: 4 });
      expect(r.totals.completionRate).toEqual({
        eligible: 4,
        completed: 3,
        rate: 75,
      });
    });

    it('summarizes response-level score when present', () => {
      const r = build({
        surveyType: 'POST_TEST',
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            score: 80,
            answers: {},
          },
          {
            submittedAt: '2026-07-10T10:00:00.000Z',
            userId: 'u2',
            score: 90,
            answers: {},
          },
          {
            submittedAt: '2026-07-10T11:00:00.000Z',
            userId: 'u3',
            score: 100,
            answers: {},
          },
        ],
      });
      expect(r.totals.score).toMatchObject({
        count: 3,
        mean: 90,
        median: 90,
        min: 80,
        max: 100,
      });
    });

    it('leaves score null when no numeric scores exist', () => {
      expect(build().totals.score).toBeNull();
    });
  });

  describe('time series', () => {
    it('buckets responses by UTC day, sorted ascending', () => {
      expect(build().timeSeries).toEqual([
        { date: '2026-07-10', count: 2 },
        { date: '2026-07-11', count: 1 },
      ]);
    });

    it('collapses multiple responses on the same UTC day into one bucket', () => {
      const r = build({
        responses: ['01:00', '09:30', '23:59'].map((t, i) => ({
          submittedAt: `2026-07-10T${t}:00.000Z`,
          userId: `u${i}`,
          answers: { role: 'MD' },
        })),
      });
      expect(r.timeSeries).toEqual([{ date: '2026-07-10', count: 3 }]);
    });

    it('keeps non-contiguous days ordered without gap-filling', () => {
      const r = build({
        responses: [
          {
            submittedAt: '2026-07-15T09:00:00.000Z',
            userId: 'u2',
            answers: { role: 'NP' },
          },
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: { role: 'MD' },
          },
        ],
      });
      // Only days with responses appear; ascending; no 07-11..07-14 fillers.
      expect(r.timeSeries).toEqual([
        { date: '2026-07-10', count: 1 },
        { date: '2026-07-15', count: 1 },
      ]);
    });
  });

  describe('per-question aggregation', () => {
    it('aggregates single_choice with declared options at zero and percentages', () => {
      const role = q<ChoiceQuestionAnalytics>(build(), 'role');
      expect(role.kind).toBe('choice');
      expect(role.multiSelect).toBe(false);
      expect(role.totalAnswered).toBe(3);
      expect(role.options).toEqual([
        { label: 'MD', count: 2, percentage: 66.7 },
        { label: 'NP', count: 1, percentage: 33.3 },
        { label: 'PA', count: 0, percentage: 0 },
      ]);
    });

    it('aggregates multi_choice (arrays), carries maxSelections, allows >100% total', () => {
      const topics = q<ChoiceQuestionAnalytics>(build(), 'topics');
      expect(topics.kind).toBe('choice');
      expect(topics.multiSelect).toBe(true);
      expect(topics.maxSelections).toBe(2);
      expect(topics.totalAnswered).toBe(3);
      const byLabel = Object.fromEntries(
        topics.options.map((o) => [o.label, o.count]),
      );
      expect(byLabel).toEqual({ A: 2, B: 2, C: 1 });

      // Percentages are per-respondent shares (of the 3 who answered), so the
      // total can exceed 100% for multi-select.
      const byPct = Object.fromEntries(
        topics.options.map((o) => [o.label, o.percentage]),
      );
      expect(byPct).toEqual({ A: 66.7, B: 66.7, C: 33.3 });
      const pctTotal = topics.options.reduce((s, o) => s + o.percentage, 0);
      expect(pctTotal).toBeGreaterThan(100);
    });

    it('aggregates rating into numeric stats + histogram', () => {
      const conf = q<RatingQuestionAnalytics>(build(), 'confidence');
      expect(conf.kind).toBe('rating');
      expect(conf).toMatchObject({
        count: 3,
        mean: 3.67,
        median: 4,
        min: 2,
        max: 5,
      });
      expect(conf.histogram).toEqual([
        { value: 2, count: 1 },
        { value: 4, count: 1 },
        { value: 5, count: 1 },
      ]);
    });

    it('rating median averages the two middle values for an even count', () => {
      const r = build({
        responses: [2, 4, 6, 10].map((score, i) => ({
          submittedAt: `2026-07-10T0${i}:00:00.000Z`,
          userId: `u${i}`,
          answers: { confidence: score },
        })),
      });
      const conf = q<RatingQuestionAnalytics>(r, 'confidence');
      expect(conf).toMatchObject({
        count: 4,
        mean: 5.5,
        median: 5, // (4 + 6) / 2
        min: 2,
        max: 10,
      });
    });

    it('aggregates long_text with de-duped, PII-redacted samples', () => {
      const comments = q<TextQuestionAnalytics>(
        build({ includeTextSamples: true }),
        'comments',
      );
      expect(comments.kind).toBe('text');
      expect(comments.responseCount).toBe(3);
      // "Great session, thanks!" appears twice -> deduped to one sample
      expect(comments.samples).toContain('Great session, thanks!');
      const redacted = comments.samples.find((s) => s.includes('Reach me'));
      expect(redacted).toBe('Reach me at [redacted-email] or [redacted-phone]');
      // no raw email/phone leaks
      expect(comments.samples.join(' ')).not.toContain('jane@example.com');
      expect(comments.samples.join(' ')).not.toContain('415-555-1212');
    });

    it('respects textSampleLimit', () => {
      const r = build({
        responses: [1, 2, 3, 4, 5, 6].map((n) => ({
          submittedAt: `2026-07-10T0${n}:00:00.000Z`,
          userId: `u${n}`,
          answers: { comments: `note ${n}` },
        })),
        includeTextSamples: true,
        textSampleLimit: 2,
      });
      expect(q<TextQuestionAnalytics>(r, 'comments').samples).toHaveLength(2);
    });

    it('excludes info questions from output', () => {
      expect(build().questions.find((x) => x.id === 'intro')).toBeUndefined();
    });
  });

  describe('schemaless / drift handling', () => {
    it('infers questions for answer keys not in the schema (Jotform-sourced)', () => {
      const r = build({
        questionsSchema: { source: 'jotform', formId: '123' },
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: { q1: 'Yes', q2: 5 },
          },
          {
            submittedAt: '2026-07-10T10:00:00.000Z',
            userId: 'u2',
            answers: { q1: 'No', q2: 3 },
          },
        ],
      });
      expect(r.hasNativeSchema).toBe(false);
      const q1 = q<ChoiceQuestionAnalytics>(r, 'q1');
      expect(q1.inferred).toBe(true);
      expect(q1.kind).toBe('choice');
      const q2 = q<RatingQuestionAnalytics>(r, 'q2');
      expect(q2.kind).toBe('rating');
      expect(q2.mean).toBe(4);
    });

    it('appends extra/drift answer keys after native schema questions, sorted and inferred', () => {
      const r = build({
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: { role: 'MD', zExtra: 'Yes', aExtra: 5 },
          },
          {
            submittedAt: '2026-07-10T10:00:00.000Z',
            userId: 'u2',
            answers: { role: 'NP', zExtra: 'No', aExtra: 3 },
          },
        ],
      });
      expect(r.hasNativeSchema).toBe(true);
      // Native schema questions (in schema order) first, then extras sorted by key.
      expect(r.questions.map((x) => x.id)).toEqual([
        'role',
        'topics',
        'confidence',
        'comments',
        'aExtra',
        'zExtra',
      ]);
      const extra = q<ChoiceQuestionAnalytics>(r, 'zExtra');
      expect(extra.inferred).toBe(true);
      const aExtra = q<RatingQuestionAnalytics>(r, 'aExtra');
      expect(aExtra.inferred).toBe(true);
      expect(aExtra.kind).toBe('rating');
    });

    it('suppresses samples for inferred free-text keys (PII safety)', () => {
      // >20 distinct values forces the free-text branch (not a choice bucket).
      const count = 25;
      const r = build({
        questionsSchema: null,
        responses: Array.from({ length: count }, (_, i) => {
          const day = String(10 + (i % 20)).padStart(2, '0');
          return {
            submittedAt: `2026-07-${day}T09:00:${String(i).padStart(2, '0')}.000Z`,
            userId: `u${i}`,
            answers: {
              freeform: `Distinct long free-form answer number ${i} contact me at user${i}@example.com`,
            },
          };
        }),
      });
      const ff = q<TextQuestionAnalytics>(r, 'freeform');
      expect(ff.kind).toBe('text');
      expect(ff.responseCount).toBe(count);
      expect(ff.samples).toEqual([]);
    });

    it('strips identity fields from answers before aggregating', () => {
      const r = build({
        questionsSchema: null,
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: { email: 'a@b.com', name: 'Jane', role: 'MD' },
          },
        ],
      });
      expect(r.questions.map((x) => x.id).sort()).toEqual(['role']);
    });
  });

  describe('empty input', () => {
    it('returns zeroed totals and empty series/questions', () => {
      const r = build({ responses: [] });
      expect(r.totals.totalResponses).toBe(0);
      expect(r.totals.uniqueRespondents).toBe(0);
      expect(r.totals.firstResponseAt).toBeNull();
      expect(r.timeSeries).toEqual([]);
      // declared schema questions still render (with zero data)
      const role = q<ChoiceQuestionAnalytics>(r, 'role');
      expect(role.totalAnswered).toBe(0);
      expect(role.options.every((o) => o.count === 0)).toBe(true);
    });
  });

  describe('PII handling for free-text (BE-5)', () => {
    it('returns counts only by default (no samples)', () => {
      const comments = q<TextQuestionAnalytics>(build(), 'comments');
      expect(comments.responseCount).toBe(3);
      expect(comments.samples).toEqual([]);
    });

    it('emits redacted samples only when includeTextSamples is true', () => {
      const off = q<TextQuestionAnalytics>(
        build({ includeTextSamples: false }),
        'comments',
      );
      expect(off.samples).toEqual([]);

      const on = q<TextQuestionAnalytics>(
        build({ includeTextSamples: true }),
        'comments',
      );
      expect(on.samples.length).toBeGreaterThan(0);
    });

    it('never surfaces identity fields as questions, even when requested inline', () => {
      // Every key the sanitizer strips, plus a legitimate question.
      const identityAnswers = {
        userId: 'u-secret',
        user_id: 'u-secret',
        programId: 'p1',
        program_id: 'p1',
        email: 'jane@example.com',
        name: 'Jane Doe',
        firstName: 'Jane',
        first_name: 'Jane',
        lastName: 'Doe',
        last_name: 'Doe',
        role: 'MD',
      };
      // Sanity-check our fixture actually contains fields the sanitizer removes.
      expect(
        Object.keys(stripIdentityFieldsFromSurveyAnswers(identityAnswers)),
      ).toEqual(['role']);

      const r = build({
        questionsSchema: null,
        includeTextSamples: true,
        responses: [
          {
            submittedAt: '2026-07-10T09:00:00.000Z',
            userId: 'u1',
            answers: identityAnswers,
          },
        ],
      });

      const ids = r.questions.map((x) => x.id);
      expect(ids).toEqual(['role']);
      for (const key of Object.keys(identityAnswers)) {
        if (key === 'role') continue;
        expect(ids).not.toContain(key);
      }
    });

    it('redacts email/phone values inside emitted samples', () => {
      const comments = q<TextQuestionAnalytics>(
        build({ includeTextSamples: true }),
        'comments',
      );
      const joined = comments.samples.join(' ');
      expect(joined).toContain('[redacted-email]');
      expect(joined).toContain('[redacted-phone]');
      expect(joined).not.toContain('jane@example.com');
      expect(joined).not.toContain('415-555-1212');
    });
  });

  describe('segment breakdown (BE-6)', () => {
    const segmented = [
      {
        submittedAt: '2026-07-10T09:00:00.000Z',
        userId: 'u1',
        answers: { role: 'MD', comments: 'note a' },
        segment: { specialty: 'Cardiology', status: 'APPROVED' },
      },
      {
        submittedAt: '2026-07-10T10:00:00.000Z',
        userId: 'u2',
        answers: { role: 'NP', comments: 'note b' },
        segment: { specialty: 'Cardiology', status: 'PENDING' },
      },
      {
        submittedAt: '2026-07-11T09:00:00.000Z',
        userId: 'u3',
        answers: { role: 'MD', comments: 'note c' },
        segment: { specialty: 'Oncology', status: 'APPROVED' },
      },
    ];

    it('is null when segmentBy is not provided', () => {
      expect(build().segments).toBeNull();
    });

    it('groups by specialty with per-group option distributions, sorted by size', () => {
      const r = build({ responses: segmented, segmentBy: 'specialty' });
      expect(r.segments?.dimension).toBe('specialty');
      const groups = r.segments!.groups;
      expect(groups.map((g) => g.key)).toEqual(['Cardiology', 'Oncology']);
      expect(groups.map((g) => g.totalResponses)).toEqual([2, 1]);

      const cardio = groups[0];
      const role = cardio.questions.find(
        (x) => x.id === 'role',
      ) as ChoiceQuestionAnalytics;
      const byLabel = Object.fromEntries(
        role.options.map((o) => [o.label, o.count]),
      );
      expect(byLabel).toEqual({ MD: 1, NP: 1, PA: 0 });

      const onco = groups[1];
      const oncoRole = onco.questions.find(
        (x) => x.id === 'role',
      ) as ChoiceQuestionAnalytics;
      expect(
        Object.fromEntries(oncoRole.options.map((o) => [o.label, o.count])),
      ).toEqual({ MD: 1, NP: 0, PA: 0 });
    });

    it('groups by status', () => {
      const r = build({ responses: segmented, segmentBy: 'status' });
      expect(r.segments?.dimension).toBe('status');
      const keys = r.segments!.groups.map((g) => g.key).sort();
      expect(keys).toEqual(['APPROVED', 'PENDING']);
    });

    it('buckets missing segment values under "unknown"/"Unknown"', () => {
      const r = build({
        responses: [
          segmented[0],
          {
            submittedAt: '2026-07-10T11:00:00.000Z',
            userId: 'u4',
            answers: { role: 'PA' },
            segment: { specialty: null },
          },
        ],
        segmentBy: 'specialty',
      });
      const unknown = r.segments!.groups.find((g) => g.key === 'unknown');
      expect(unknown).toBeDefined();
      expect(unknown!.label).toBe('Unknown');
      expect(unknown!.totalResponses).toBe(1);
    });

    it('never emits free-text samples inside segment groups, even when includeTextSamples is true', () => {
      const r = build({
        responses: segmented,
        segmentBy: 'specialty',
        includeTextSamples: true,
      });
      for (const group of r.segments!.groups) {
        const comments = group.questions.find(
          (x) => x.id === 'comments',
        ) as TextQuestionAnalytics;
        expect(comments.samples).toEqual([]);
      }
      // top-level still honors the flag
      const topComments = q<TextQuestionAnalytics>(
        build({ responses: segmented, includeTextSamples: true }),
        'comments',
      );
      expect(topComments.samples.length).toBeGreaterThan(0);
    });
  });
});
