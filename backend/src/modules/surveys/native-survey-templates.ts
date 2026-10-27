type NativeQuestion = Record<string, unknown>;

function section(id: string, title: string, questions: NativeQuestion[]) {
  return { id, title, questions };
}

function single(
  id: string,
  prompt: string,
  options: string[],
  opts?: { required?: boolean; followUp?: NativeQuestion },
): NativeQuestion {
  return {
    id,
    type: 'single_choice',
    prompt,
    required: opts?.required ?? true,
    options,
    ...(opts?.followUp ? { followUp: opts.followUp } : {}),
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
  },
): NativeQuestion {
  return {
    id,
    type: opts?.long ? 'long_text' : 'text',
    prompt,
    required: opts?.required ?? true,
    ...(opts?.syncToProfile ? { syncToProfile: opts.syncToProfile } : {}),
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
 * Default post-event FEEDBACK template (CPR-5: topic-neutral).
 * For disease-specific questions, clone a customized FEEDBACK survey onto the
 * new program via `feedbackSurveySourceId` when scheduling.
 */
export function defaultPostEventFeedbackQuestions() {
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
