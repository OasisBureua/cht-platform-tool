/** Combined stored value replaces separate Student + Researcher dropdown options */
export const STUDENT_RESEARCHER_VALUE = 'StudentResearcher';

/** Stored as `User.specialty` — same options across signup / complete-profile / settings. */
export const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Oncologist', label: 'Oncologist' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Industry', label: 'Industry / Non-Clinical' },
  {
    value: STUDENT_RESEARCHER_VALUE,
    label: 'Student / Researcher or Scientist',
  },
] as const;

/**
 * Backend may still hold removed option values — treat these as non-HCP for NPI rules.
 */
export const NON_HCP_PROFESSIONS = new Set([
  'Industry',
  'Pharmaceuticals',
  STUDENT_RESEARCHER_VALUE,
  'Researcher',
  'Student',
  'Patient Advocate',
  'Caregiver',
  'Other',
]);

/** Licensed HCPs for honorarium / NPI workflows (badge logic, etc.). Legacy values kept for existing rows. */
export const HCP_PROFESSIONS = new Set([
  'Physician',
  'Oncologist',
  'Nurse Practitioner',
  'Physician Assistant',
  'Pharmacist',
  'Nurse',
  'Other HCP',
]);

/** How Settings labels the institution/location block (same API fields everywhere). */
export type SettingsLocationPreset = 'practice' | 'studentResearcher' | 'industry';

export function settingsLocationPreset(specialty: string): SettingsLocationPreset {
  const v = specialty.trim();
  if (v === STUDENT_RESEARCHER_VALUE || v === 'Student' || v === 'Researcher') return 'studentResearcher';
  if (v === 'Industry' || v === 'Pharmaceuticals') return 'industry';
  return 'practice';
}

export function professionRequiresNpi(specialty: string): boolean {
  if (!specialty.trim()) return false;
  return !NON_HCP_PROFESSIONS.has(specialty);
}

/** Map persisted specialty → value for `<select>` (combines legacy Student / Researcher). */
export function specialtyToSelectValue(specialty: string | undefined | null): string {
  if (!specialty?.trim()) return '';
  if (specialty === 'Student' || specialty === 'Researcher') return STUDENT_RESEARCHER_VALUE;
  return specialty;
}

/** Same as PROFESSION_OPTIONS — explicit alias for signup copy. */
export function signupProfessionSelectOptions(): { value: string; label: string }[] {
  return [...PROFESSION_OPTIONS];
}

/**
 * Include persisted or in-progress selections that are no longer in the curated list (valid `<select>` + HTML constraint).
 */
export function professionOptionsForSelect(...savedOrCurrentValues: Array<string | null | undefined>): {
  value: string;
  label: string;
}[] {
  const opts: { value: string; label: string }[] = [...PROFESSION_OPTIONS];
  const seen = new Set(opts.map((o) => o.value));
  const rawSeen = new Set<string>();
  for (const k of savedOrCurrentValues) {
    const raw = (k ?? '').trim();
    if (!raw || rawSeen.has(raw)) continue;
    rawSeen.add(raw);
    const sel = specialtyToSelectValue(raw);
    if (!seen.has(sel)) {
      opts.push({ value: sel, label: `${sel} (previous selection)` });
      seen.add(sel);
    }
  }
  return opts;
}
