/**
 * HTML autocomplete / input type hints for native survey text fields so
 * browsers and mobile keyboards can suggest saved contact details.
 */

export type SurveyFieldInputHints = {
  autoComplete: string;
  inputType: 'text' | 'email' | 'tel';
};

const BY_SYNC_TARGET: Record<string, SurveyFieldInputHints> = {
  firstName: { autoComplete: 'given-name', inputType: 'text' },
  lastName: { autoComplete: 'family-name', inputType: 'text' },
  email: { autoComplete: 'email', inputType: 'email' },
  phoneNumber: { autoComplete: 'tel', inputType: 'tel' },
  specialty: { autoComplete: 'organization-title', inputType: 'text' },
  npiNumber: { autoComplete: 'off', inputType: 'text' },
  institution: { autoComplete: 'organization', inputType: 'text' },
  city: { autoComplete: 'address-level2', inputType: 'text' },
  state: { autoComplete: 'address-level1', inputType: 'text' },
  zipCode: { autoComplete: 'postal-code', inputType: 'text' },
};

const BY_QUESTION_ID: Record<string, SurveyFieldInputHints> = {
  firstname: BY_SYNC_TARGET.firstName,
  first_name: BY_SYNC_TARGET.firstName,
  lastname: BY_SYNC_TARGET.lastName,
  last_name: BY_SYNC_TARGET.lastName,
  email: BY_SYNC_TARGET.email,
  phone: BY_SYNC_TARGET.phoneNumber,
  phonenumber: BY_SYNC_TARGET.phoneNumber,
  phone_number: BY_SYNC_TARGET.phoneNumber,
  specialty: BY_SYNC_TARGET.specialty,
  npi: BY_SYNC_TARGET.npiNumber,
  npinumber: BY_SYNC_TARGET.npiNumber,
  npi_number: BY_SYNC_TARGET.npiNumber,
  organization: BY_SYNC_TARGET.institution,
  organisation: BY_SYNC_TARGET.institution,
  institution: BY_SYNC_TARGET.institution,
  affiliation: BY_SYNC_TARGET.institution,
  city: BY_SYNC_TARGET.city,
  state: BY_SYNC_TARGET.state,
  zip: BY_SYNC_TARGET.zipCode,
  zipcode: BY_SYNC_TARGET.zipCode,
  zip_code: BY_SYNC_TARGET.zipCode,
  postal_code: BY_SYNC_TARGET.zipCode,
  address_street: { autoComplete: 'address-line1', inputType: 'text' },
  address_line2: { autoComplete: 'address-line2', inputType: 'text' },
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, '');
}

/**
 * Resolve autocomplete + input type from syncToProfile tag and/or question id.
 */
export function surveyFieldInputHints(opts: {
  questionId?: string | null;
  syncToProfile?: string | null;
  prompt?: string | null;
}): SurveyFieldInputHints {
  if (opts.syncToProfile && BY_SYNC_TARGET[opts.syncToProfile]) {
    return BY_SYNC_TARGET[opts.syncToProfile];
  }
  const qid = opts.questionId ? normalizeKey(opts.questionId) : '';
  if (qid && BY_QUESTION_ID[qid]) return BY_QUESTION_ID[qid];

  const prompt = (opts.prompt ?? '').toLowerCase();
  if (/\bemail\b/.test(prompt)) return BY_SYNC_TARGET.email;
  if (/\b(phone|mobile|cell)\b/.test(prompt)) return BY_SYNC_TARGET.phoneNumber;
  if (/\bnpi\b/.test(prompt)) return BY_SYNC_TARGET.npiNumber;
  if (/\b(first\s*name|given\s*name)\b/.test(prompt)) return BY_SYNC_TARGET.firstName;
  if (/\b(last\s*name|family\s*name|surname)\b/.test(prompt)) {
    return BY_SYNC_TARGET.lastName;
  }
  if (/\b(organization|organisation|institution|affiliation)\b/.test(prompt)) {
    return BY_SYNC_TARGET.institution;
  }
  if (/^\s*city\b/.test(prompt)) return BY_SYNC_TARGET.city;
  if (/^\s*state\b/.test(prompt)) return BY_SYNC_TARGET.state;
  if (/\b(zip|postal)\b/.test(prompt)) return BY_SYNC_TARGET.zipCode;

  return { autoComplete: 'on', inputType: 'text' };
}

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  specialty: 'Specialty',
  npiNumber: 'NPI number',
  institution: 'Organization',
  city: 'City',
  state: 'State',
  zipCode: 'Postal / ZIP code',
  phoneNumber: 'Phone number',
};
