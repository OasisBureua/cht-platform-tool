import { validateNativeSurveySchema } from '../../utils/survey-schema';
import { buildSurveyResponseAnalytics } from '../../utils/survey-analytics';
import {
  defaultHcpBetaTestingSurveyQuestions,
  EASE_SCALE_5,
  HCP_BETA_TESTING_TEMPLATE_ID,
} from './native-survey-templates';

describe('HCP Beta Testing Survey template', () => {
  it('validates as a native survey schema with templateId', () => {
    const raw = defaultHcpBetaTestingSurveyQuestions();
    expect(raw.templateId).toBe(HCP_BETA_TESTING_TEMPLATE_ID);
    const validated = validateNativeSurveySchema(raw);
    expect(validated.sections.length).toBeGreaterThanOrEqual(5);
  });

  it('contains 16 answerable questions in order (Q1–Q16) plus intro', () => {
    const raw = defaultHcpBetaTestingSurveyQuestions();
    const ids = raw.sections.flatMap((s) => s.questions.map((q) => q.id));
    expect(ids).toContain('intro_notice');
    expect(ids).toEqual(
      expect.arrayContaining([
        'q1_login_ease',
        'q2_login_experience',
        'q3_time_to_dashboard',
        'q4_account_create_ease',
        'q5_registration_time',
        'q6_hardest_registration_step',
        'q7_join_livestream_ease',
        'q8_livestream_details_clarity',
        'q9_av_quality',
        'q10_honorarium_clarity',
        'q11_payment_setup_ease',
        'q12_payment_timeline_reasonableness',
        'q13_technical_issues_frequency',
        'q14_overall_satisfaction',
        'q15_recommend_likelihood',
        'q16_additional_comments',
      ]),
    );
    const answerable = raw.sections
      .flatMap((s) => s.questions)
      .filter((q) => q.type !== 'info');
    expect(answerable).toHaveLength(16);
  });

  it('computes ease averages and NPS from scoring metadata', () => {
    const questions = defaultHcpBetaTestingSurveyQuestions();
    const analytics = buildSurveyResponseAnalytics({
      surveyType: 'FEEDBACK',
      questionsSchema: questions,
      responses: [
        {
          submittedAt: '2026-10-28T12:00:00.000Z',
          userId: 'u1',
          responseId: 'r1',
          answers: {
            q1_login_ease: EASE_SCALE_5[4], // 5
            q4_account_create_ease: EASE_SCALE_5[3], // 4
            q7_join_livestream_ease: EASE_SCALE_5[2], // 3
            q11_payment_setup_ease: 'Not applicable',
            q15_recommend_likelihood: 10,
            q16_additional_comments: 'Login was smooth.',
          },
          commentStageTags: ['access'],
        },
        {
          submittedAt: '2026-10-28T13:00:00.000Z',
          userId: 'u2',
          responseId: 'r2',
          answers: {
            q1_login_ease: EASE_SCALE_5[0], // 1
            q4_account_create_ease: EASE_SCALE_5[1], // 2
            q7_join_livestream_ease: EASE_SCALE_5[4], // 5
            q11_payment_setup_ease: EASE_SCALE_5[4], // 5
            q15_recommend_likelihood: 6,
            q16_additional_comments: 'Payment setup unclear.',
          },
          commentStageTags: ['honorarium'],
        },
      ],
    });

    expect(analytics.betaInsights).not.toBeNull();
    const ease = Object.fromEntries(
      analytics.betaInsights!.easeByStage.map((e) => [e.stage, e.average]),
    );
    expect(ease.access).toBe(3); // (5+1)/2
    expect(ease.registration).toBe(3); // (4+2)/2
    expect(ease.livestream).toBe(4); // (3+5)/2
    expect(ease.honorarium).toBe(5); // only one rated (N/A excluded)

    expect(analytics.betaInsights!.nps).toMatchObject({
      promoters: 1,
      passives: 0,
      detractors: 1,
      totalRated: 2,
      score: 0, // 50% promoters - 50% detractors
    });

    expect(analytics.betaInsights!.comments).toHaveLength(2);
    expect(analytics.betaInsights!.comments[0].stageTags).toEqual(['access']);
  });
});
