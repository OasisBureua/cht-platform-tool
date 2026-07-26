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
  opts?: { required?: boolean; long?: boolean },
): NativeQuestion {
  return {
    id,
    type: opts?.long ? 'long_text' : 'text',
    prompt,
    required: opts?.required ?? true,
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
        text('phone', 'Phone number', { required: false }),
        text('npi', 'NPI number', { required: false }),
        text('organization', 'Organization', { required: true }),
        text('address_street', 'Company address: street', { required: false }),
        text('address_line2', 'Street address line 2', { required: false }),
        text('city', 'City', { required: true }),
        text('state', 'State / Province', { required: true }),
        text('postal_code', 'Postal / Zip code', { required: false }),
        text('company_website', 'Company website', { required: false }),
        text('linkedin', 'LinkedIn account handle', { required: false }),
        text('x_handle', 'X account handle', { required: false }),
      ]),
    ],
  };
}

/** Default post-event FEEDBACK template (oncology example from Phase 0 PDF). */
export function defaultPostEventFeedbackQuestions() {
  return {
    version: 1,
    sections: [
      section('demographics', 'About you', [
        text('npi', 'NPI number', { required: false }),
        single('q1_role', 'Which best describes your primary role?', [
          'Medical Oncologist',
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
        single(
          'q3_years_practice',
          'Years in independent clinical practice',
          ['0–5', '6–10', '11–20', '>20', 'Prefer not to answer'],
        ),
        single(
          'q4_her2_patients',
          'HER2+ mBC patients you actively manage',
          ['≤5', '6–10', '11–20', '21–40', '>40'],
        ),
        single('q5_tdxd_patients', 'Patients you have treated with T-DXd to date', [
          '0',
          '1–5',
          '6–15',
          '>15',
          'Unsure',
        ]),
      ]),
      section('clinical', 'Clinical practice', [
        single(
          'q6_initial_regimen',
          'For de novo or relapsed HER2-positive metastatic breast cancer, what is your typical initial systemic regimen?',
          [
            'THP (docetaxel + trastuzumab + pertuzumab)',
            'T-DXd + pertuzumab',
            'T-DM1-based',
            'Other / trial-based',
            'No single go-to; case-by-case',
          ],
          {
            followUp: {
              whenOption: 'No single go-to; case-by-case',
              question: text('q6_other', 'Briefly describe:', { required: false }),
            },
          },
        ),
        single(
          'q7_hr_plan',
          'For HR+/HER2+ disease, what is your typical endocrine + anti-HER2 plan?',
          [
            'Endocrine + trastuzumab ± pertuzumab',
            'Chemotherapy + anti-HER2 upfront',
            'T-DXd-containing',
            'Varies substantially by patient factors',
            'Other',
          ],
          {
            followUp: {
              whenOption: 'Varies substantially by patient factors',
              question: text('q7_other', 'Briefly describe:', { required: false }),
            },
          },
        ),
        single('q8_db09', 'How familiar are you with the DB-09 trial data?', [
          'Not familiar',
          'Aware but have not reviewed in detail',
          'Reviewed data; not yet changed practice',
          'Reviewed data; already influencing practice',
          'Presented / taught on this data',
        ]),
        multi(
          'q12_tdxd_factors',
          'Factors pushing T-DXd + pertuzumab in 1L (select up to 3)',
          [
            'Efficacy vs THP',
            'CNS activity',
            'Patient preference',
            'Guideline alignment',
            'Institutional pathway',
            'Prior exposure / sequencing',
            'Other',
          ],
          3,
        ),
        single(
          'q21_post_progression',
          'After progression on T-DXd + pertuzumab, what is your typical next regimen?',
          [
            'T-DM1',
            'Tucatinib-based',
            'Clinical trial',
            'Chemotherapy + trastuzumab',
            'Depends on site pathways and prior exposure',
            'Other',
          ],
          {
            followUp: {
              whenOption: 'Depends on site pathways and prior exposure',
              question: text('q21_other', 'Briefly describe:', { required: false }),
            },
          },
        ),
        text(
          'q23_faculty',
          'What change do you anticipate in your practice, and what questions remain for faculty?',
          { required: true, long: true },
        ),
      ]),
    ],
  };
}
