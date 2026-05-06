/** Stored as `User.specialty` — same options as legacy complete-profile flow. */
export const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
  { value: 'Industry', label: 'Industry / Non-Clinical' },
  { value: 'Researcher', label: 'Researcher / Scientist' },
  { value: 'Patient Advocate', label: 'Patient / Patient Advocate' },
  { value: 'Caregiver', label: 'Caregiver' },
  { value: 'Student', label: 'Student' },
  { value: 'Other', label: 'Other' },
] as const;

/** Professions that do NOT require an NPI number. Includes legacy 'Pharmaceuticals' value for existing users. */
export const NON_HCP_PROFESSIONS = new Set([
  'Industry',
  'Pharmaceuticals',
  'Researcher',
  'Patient Advocate',
  'Caregiver',
  'Student',
  'Other',
]);

/** Professions that are licensed HCPs eligible for honoraria and NPI-based workflows. */
export const HCP_PROFESSIONS = new Set([
  'Physician',
  'Nurse Practitioner',
  'Physician Assistant',
  'Pharmacist',
  'Nurse',
  'Other HCP',
]);
