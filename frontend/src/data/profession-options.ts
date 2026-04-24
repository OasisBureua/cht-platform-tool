/** Stored as `User.specialty` — same options as legacy complete-profile flow. */
export const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
] as const;
