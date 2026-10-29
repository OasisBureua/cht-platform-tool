type NativeQuestion = Record<string, unknown>;

/** Canonical 5-point ease scale (maps to scores 1–5 left→right). */
export const EASE_SCALE_5 = [
  'Very difficult',
  'Difficult',
  'Neither difficult nor easy',
  'Easy',
  'Very easy',
] as const;

const CLARITY_SCALE_5 = [
  'Very unclear',
  'Unclear',
  'Neither unclear nor clear',
  'Clear',
  'Very clear',
] as const;

const QUALITY_SCALE_5 = [
  'Very poor',
  'Poor',
  'Fair',
  'Good',
  'Excellent',
] as const;

const SATISFACTION_SCALE_5 = [
  'Very dissatisfied',
  'Dissatisfied',
  'Neither dissatisfied nor satisfied',
  'Satisfied',
  'Very satisfied',
] as const;

const REASONABLENESS_SCALE = [
  'Very unreasonable',
  'Unreasonable',
  'Neither unreasonable nor reasonable',
  'Reasonable',
  'Very reasonable',
  'No timeline was provided',
] as const;

export const HCP_BETA_COMMENT_STAGES = [
  'access',
  'registration',
  'livestream',
  'honorarium',
] as const;

export type HcpBetaCommentStage = (typeof HCP_BETA_COMMENT_STAGES)[number];

export const HCP_BETA_TESTING_TEMPLATE_ID = 'hcp-beta-testing-v1';

function section(id: string, title: string, questions: NativeQuestion[]) {
  return { id, title, questions };
}

function single(
  id: string,
  prompt: string,
  options: readonly string[] | string[],
  opts?: {
    required?: boolean;
    followUp?: NativeQuestion;
    scoring?: Record<string, unknown>;
  },
): NativeQuestion {
  return {
    id,
    type: 'single_choice',
    prompt,
    required: opts?.required ?? true,
    options: [...options],
    ...(opts?.followUp ? { followUp: opts.followUp } : {}),
    ...(opts?.scoring ? { scoring: opts.scoring } : {}),
  };
}

function multi(
  id: string,
  prompt: string,
  options: string[],
  maxSelections: number,
): NativeQuestion {
  return {
    id,
    type: 'multi_choice',
    prompt,
    required: true,
    maxSelections,
    options,
  };
}

function text(
  id: string,
  prompt: string,
  opts?: {
    required?: boolean;
    long?: boolean;
    /** Maps this answer to a User profile column (SCRUM-186). */
    syncToProfile?: string;
    scoring?: Record<string, unknown>;
  },
): NativeQuestion {
  return {
    id,
    type: opts?.long ? 'long_text' : 'text',
    prompt,
    required: opts?.required ?? true,
    ...(opts?.syncToProfile ? { syncToProfile: opts.syncToProfile } : {}),
    ...(opts?.scoring ? { scoring: opts.scoring } : {}),
  };
}

function rating(
  id: string,
  prompt: string,
  scaleMin: number,
  scaleMax: number,
  opts?: { required?: boolean; scoring?: Record<string, unknown> },
): NativeQuestion {
  return {
    id,
    type: 'rating',
    prompt,
    required: opts?.required ?? true,
    scaleMin,
    scaleMax,
    ...(opts?.scoring ? { scoring: opts.scoring } : {}),
  };
}

function info(id: string, prompt: string): NativeQuestion {
  return { id, type: 'info', prompt, required: false };
}

/** Default webinar registration intake (identity from auth session: not collected here). */
export function defaultWebinarIntakeQuestions() {
  return {
    version: 1,
    sections: [
      section('intake', 'Registration details', [
        info(
          'intake_email_notice',
          'We will send your confirmation and join link to the email on your account.',
        ),
        text('phone', 'Phone number', {
          required: false,
          syncToProfile: 'phoneNumber',
        }),
        text('npi', 'NPI number', {
          required: false,
          syncToProfile: 'npiNumber',
        }),
        text('organization', 'Organization', {
          required: true,
          syncToProfile: 'institution',
        }),
        // Street lines are intake-only (User profile has no street fields).
        text('address_street', 'Company address: street', { required: false }),
        text('address_line2', 'Street address line 2', { required: false }),
        text('city', 'City', { required: true, syncToProfile: 'city' }),
        text('state', 'State / Province', {
          required: true,
          syncToProfile: 'state',
        }),
        text('postal_code', 'Postal / Zip code', {
          required: false,
          syncToProfile: 'zipCode',
        }),
        text('company_website', 'Company website', { required: false }),
        text('linkedin', 'LinkedIn account handle', { required: false }),
        text('x_handle', 'X account handle', { required: false }),
      ]),
    ],
  };
}

/**
 * Default post-event FEEDBACK template — HCP Beta Testing Survey
 * (questionnaire dated Oct 26, 2026). Topic-neutral; ~5 minutes; 16 questions.
 * Completing this survey is the gate for the $200 beta honorarium.
 *
 * Skip policy: intro allows skipping questions that do not apply. All items
 * are optional at the form level except that a submission is still required
 * once to acknowledge completion for payment. Q16 is free-text optional.
 */
export function defaultPostEventFeedbackQuestions() {
  return defaultHcpBetaTestingSurveyQuestions();
}

/**
 * HCP Beta Testing Survey — native FEEDBACK template.
 * Prefer {@link defaultPostEventFeedbackQuestions} at call sites that create
 * program FEEDBACK rows; this export is the named template for docs/tests.
 */
export function defaultHcpBetaTestingSurveyQuestions() {
  // Skip-friendly: required false so unanswered questions do not block submit.
  const skippable = { required: false as const };

  return {
    version: 1,
    templateId: HCP_BETA_TESTING_TEMPLATE_ID,
    sections: [
      section('intro', 'Introduction', [
        info(
          'intro_notice',
          'Thank you for participating in the Community Health Media beta. Your responses are confidential and will be reported in aggregate only. They have no bearing on your eligibility for future studies or honoraria. If a question does not apply to you, you may skip it.',
        ),
      ]),
      section('platform_access', 'Platform Access', [
        single(
          'q1_login_ease',
          'How easy was it to log in to the platform?',
          EASE_SCALE_5,
          {
            ...skippable,
            scoring: { kind: 'ease', stage: 'access' },
          },
        ),
        single(
          'q2_login_experience',
          'Which best describes your login experience?',
          [
            'I logged in successfully on the first attempt',
            'I needed to reset my password',
            'I had trouble with a verification code or two-factor authentication',
            'I was unable to log in at least once',
          ],
          skippable,
        ),
        single(
          'q3_time_to_dashboard',
          'About how long did it take you to reach the dashboard after starting login?',
          [
            'Under 30 seconds',
            '30–60 seconds',
            '1–3 minutes',
            'Over 3 minutes',
          ],
          skippable,
        ),
      ]),
      section('registration_credentialing', 'Account Registration and Credentialing', [
        single(
          'q4_account_create_ease',
          'How easy was it to create your account?',
          EASE_SCALE_5,
          {
            ...skippable,
            scoring: { kind: 'ease', stage: 'registration' },
          },
        ),
        single(
          'q5_registration_time',
          'About how long did registration take, including credential verification?',
          [
            'Under 5 minutes',
            '5–15 minutes',
            '16–30 minutes',
            'Over 30 minutes',
            'I did not complete registration',
          ],
          skippable,
        ),
        single(
          'q6_hardest_registration_step',
          'Which step caused the greatest difficulty?',
          [
            'None — registration was straightforward',
            'Entering professional details',
            'Email confirmation',
            'Entering NPI or license number',
            'Waiting for verification',
            'Terms and consent',
            'Other',
          ],
          skippable,
        ),
      ]),
      section('livestream', 'Livestream Participation', [
        single(
          'q7_join_livestream_ease',
          'How easy was it to find and join the livestream?',
          EASE_SCALE_5,
          {
            ...skippable,
            scoring: { kind: 'ease', stage: 'livestream' },
          },
        ),
        single(
          'q8_livestream_details_clarity',
          'How clear were the livestream details (date and time, joining instructions, and duration)?',
          CLARITY_SCALE_5,
          skippable,
        ),
        single(
          'q9_av_quality',
          'How would you rate the audio and video quality, including the podcast clip?',
          QUALITY_SCALE_5,
          skippable,
        ),
      ]),
      section('honorarium', 'Honorarium and Payment Processing', [
        single(
          'q10_honorarium_clarity',
          'Before today, how clear was it that the $200 honorarium is issued after you complete this survey, and how it is paid?',
          CLARITY_SCALE_5,
          skippable,
        ),
        single(
          'q11_payment_setup_ease',
          'How easy was it to set up your preferred payment method?',
          [...EASE_SCALE_5, 'Not applicable'],
          {
            ...skippable,
            scoring: {
              kind: 'ease',
              stage: 'honorarium',
              excludeOptions: ['Not applicable'],
            },
          },
        ),
        single(
          'q12_payment_timeline_reasonableness',
          'How reasonable is the timeline for receiving the $200 honorarium?',
          REASONABLENESS_SCALE,
          skippable,
        ),
      ]),
      section('overall', 'Overall Evaluation', [
        single(
          'q13_technical_issues_frequency',
          'How often did you experience technical issues on the platform?',
          [
            'Never',
            'Once or twice',
            'Several times',
            'Continually',
          ],
          skippable,
        ),
        single(
          'q14_overall_satisfaction',
          'Overall, how satisfied are you with the platform experience?',
          SATISFACTION_SCALE_5,
          skippable,
        ),
        rating(
          'q15_recommend_likelihood',
          'How likely are you to recommend Community Health Media to a colleague? (0 = Not at all likely, 10 = Extremely likely)',
          0,
          10,
          {
            ...skippable,
            scoring: { kind: 'nps' },
          },
        ),
        text(
          'q16_additional_comments',
          'Optional: Is there anything else you would like us to know about your experience?',
          {
            required: false,
            long: true,
            scoring: {
              kind: 'comment',
              taggableStages: [...HCP_BETA_COMMENT_STAGES],
            },
          },
        ),
      ]),
    ],
  };
}

/** @deprecated Kept for tests that imported the old clinical FEEDBACK template name. */
export function defaultPostEventFeedbackQuestionsLegacy() {
  return {
    version: 1,
    sections: [
      section('demographics', 'About you', [
        text('npi', 'NPI number', { required: false }),
        single('q1_role', 'Which best describes your primary role?', [
          'Physician',
          'Advanced Practice Provider (NP/PA)',
          'Pharmacist',
          'Nurse / Navigator',
          'Other',
        ]),
        single('q2_setting', 'Which best describes your practice setting?', [
          'Academic / teaching',
          'Community with research',
          'Community without research',
          'Hybrid',
          'Other',
        ]),
        single('q3_years_practice', 'Years in independent clinical practice', [
          '0–5',
          '6–10',
          '11–20',
          '>20',
          'Prefer not to answer',
        ]),
      ]),
      section('session', 'About this session', [
        single(
          'q4_objectives_met',
          'Overall, how well did this session meet its learning objectives?',
          [
            'Not at all',
            'Slightly',
            'Moderately',
            'Very well',
            'Completely',
          ],
        ),
        single(
          'q5_content_relevance',
          'How relevant was the content to your clinical practice?',
          [
            'Not relevant',
            'Slightly relevant',
            'Moderately relevant',
            'Very relevant',
            'Extremely relevant',
          ],
        ),
        single(
          'q6_practice_change',
          'How likely are you to change something in your practice based on this session?',
          [
            'Not likely',
            'Somewhat likely',
            'Likely',
            'Very likely',
            'Already planning a change',
          ],
        ),
        multi(
          'q7_valuable_aspects',
          'What was most valuable? (select up to 3)',
          [
            'Clinical evidence / data',
            'Practical case discussion',
            'Peer perspectives',
            'Faculty Q&A',
            'Guidelines / pathways',
            'Other',
          ],
          3,
        ),
        text(
          'q8_practice_notes',
          'What change do you anticipate in your practice, and what questions remain for faculty?',
          { required: true, long: true },
        ),
      ]),
    ],
  };
}
