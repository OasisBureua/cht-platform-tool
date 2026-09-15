/**
 * SCRUM-186 profile pre-fill + write-back.
 *
 * Survey questions may opt into "sync with User profile" by setting
 * `syncToProfile: '<user-field>'` on the question JSON. When a survey
 * response is submitted, matching answers are written back to the User
 * table. When the same survey is loaded again (by the same user or a
 * different program), the questions can be pre-filled with the current
 * User field values.
 *
 * Questions without an explicit tag are still mapped when their id or
 * prompt clearly matches a profile field (webinar intake templates use
 * ids like `npi`, `organization`, `postal_code`).
 */

import {
  normalizeUsStateCode,
  normalizeUsZip5,
} from '../../common/us-address';
import {
  listNativeSurveyQuestions,
  type NativeSurveyQuestion,
} from '../../utils/survey-schema';

/**
 * User columns that may be sync-targeted. Additions require both a Prisma
 * schema field and (usually) a normalizer in the writeUserProfileFromAnswers
 * function below.
 */
export const SYNC_TARGET_FIELDS = [
  'firstName',
  'lastName',
  'specialty',
  'npiNumber',
  'institution',
  'city',
  'state',
  'zipCode',
] as const;

export type SyncTargetField = (typeof SYNC_TARGET_FIELDS)[number];

export function isSyncTargetField(value: unknown): value is SyncTargetField {
  return (
    typeof value === 'string' &&
    (SYNC_TARGET_FIELDS as readonly string[]).includes(value)
  );
}

/**
 * User profile subset used both for pre-fill lookups and for the outbound
 * sync at write time.
 */
export type SyncableUserProfile = {
  firstName: string;
  lastName: string;
  specialty: string | null;
  npiNumber: string | null;
  institution: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

type QuestionWithSync = NativeSurveyQuestion & {
  syncToProfile?: unknown;
  prompt?: unknown;
};

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Infer a profile field from question id / prompt when syncToProfile is
 * unset. Prefer explicit tags; keep heuristics conservative so free-text
 * clinical questions are not remapped.
 */
export function inferSyncTargetFromQuestion(
  q: NativeSurveyQuestion,
): SyncTargetField | null {
  const qid = typeof q.id === 'string' ? normalizeKey(q.id) : '';
  const prompt =
    typeof (q as QuestionWithSync).prompt === 'string'
      ? String((q as QuestionWithSync).prompt).toLowerCase()
      : '';
  const promptKey = normalizeKey(prompt);

  // Id aliases used by default webinar intake (and common admin copies).
  const idAlias: Record<string, SyncTargetField> = {
    firstname: 'firstName',
    first_name: 'firstName',
    lastname: 'lastName',
    last_name: 'lastName',
    specialty: 'specialty',
    npi: 'npiNumber',
    npinumber: 'npiNumber',
    npi_number: 'npiNumber',
    organization: 'institution',
    organisation: 'institution',
    institution: 'institution',
    company: 'institution',
    city: 'city',
    state: 'state',
    province: 'state',
    zip: 'zipCode',
    zipcode: 'zipCode',
    zip_code: 'zipCode',
    postal: 'zipCode',
    postalcode: 'zipCode',
    postal_code: 'zipCode',
  };
  if (qid && idAlias[qid]) return idAlias[qid];

  // Prompt heuristics (order: more specific first).
  if (/\bnpi\b/.test(prompt) || promptKey.includes('npinumber')) {
    return 'npiNumber';
  }
  if (
    /\b(first\s*name|given\s*name)\b/.test(prompt) ||
    promptKey === 'firstname'
  ) {
    return 'firstName';
  }
  if (
    /\b(last\s*name|surname|family\s*name)\b/.test(prompt) ||
    promptKey === 'lastname'
  ) {
    return 'lastName';
  }
  if (/\bspecialty\b|\bspeciality\b/.test(prompt)) {
    return 'specialty';
  }
  if (
    /\b(organization|organisation|institution|company)\b/.test(prompt) &&
    !/\b(address|street|website|url)\b/.test(prompt)
  ) {
    return 'institution';
  }
  if (/^\s*city\b/.test(prompt) || promptKey === 'city') {
    return 'city';
  }
  if (
    /^\s*state\b/.test(prompt) ||
    /\bstate\s*\/\s*province\b/.test(prompt) ||
    promptKey === 'state' ||
    promptKey === 'stateprovince'
  ) {
    return 'state';
  }
  if (
    /\b(postal|zip)\b/.test(prompt) ||
    promptKey.includes('postal') ||
    promptKey.includes('zip')
  ) {
    return 'zipCode';
  }

  return null;
}

/**
 * Resolve the sync target for a question: explicit tag wins, else inference.
 */
export function resolveSyncTarget(
  q: NativeSurveyQuestion,
): SyncTargetField | null {
  const sync = (q as QuestionWithSync).syncToProfile;
  if (isSyncTargetField(sync)) return sync;
  return inferSyncTargetFromQuestion(q);
}

/**
 * Read a flat list of `{ questionId, syncToProfile }` mappings from a
 * survey's questions JSON. Uses the shared native-survey flattener so it
 * agrees with CSV export / analytics on question shape and never throws
 * on legacy Jotform placeholder metadata.
 */
export function extractProfileMappings(
  questions: unknown,
): Array<{ questionId: string; field: SyncTargetField }> {
  const out: Array<{ questionId: string; field: SyncTargetField }> = [];
  const seen = new Set<string>();
  for (const q of listNativeSurveyQuestions(questions)) {
    const qid = typeof q.id === 'string' ? q.id : undefined;
    if (!qid || seen.has(qid)) continue;
    const field = resolveSyncTarget(q);
    if (!field) continue;
    seen.add(qid);
    out.push({ questionId: qid, field });
  }
  return out;
}

/**
 * Build a pre-fill map for the frontend: `{ questionId: currentUserValue }`.
 * Only includes questions whose mapped User field has a non-null value.
 */
export function buildProfilePrefill(
  questions: unknown,
  profile: SyncableUserProfile,
): Record<string, string> {
  const prefill: Record<string, string> = {};
  for (const { questionId, field } of extractProfileMappings(questions)) {
    const value = profile[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      prefill[questionId] = value;
    }
  }
  return prefill;
}

/**
 * Extract profile updates from survey answers. Applies the same
 * normalization rules the dashboard/profile flow uses (state code lookup,
 * ZIP5 truncation, NPI digit stripping). Values that fail normalization
 * are silently skipped rather than throwing — a survey submit should never
 * fail because a free-text state entry doesn't match a US state code.
 */
export function extractProfileUpdatesFromAnswers(
  questions: unknown,
  answers: Record<string, unknown>,
): Partial<SyncableUserProfile> {
  const updates: Partial<SyncableUserProfile> = {};
  for (const { questionId, field } of extractProfileMappings(questions)) {
    const raw = answers[questionId];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    switch (field) {
      case 'firstName':
      case 'lastName':
        updates[field] = trimmed;
        break;
      case 'specialty':
      case 'institution':
      case 'city':
        updates[field] = trimmed;
        break;
      case 'state': {
        const normalized = normalizeUsStateCode(trimmed);
        if (normalized) updates.state = normalized;
        break;
      }
      case 'zipCode': {
        const normalized = normalizeUsZip5(trimmed);
        if (normalized) updates.zipCode = normalized;
        break;
      }
      case 'npiNumber': {
        const digits = trimmed.replace(/\D/g, '').slice(0, 10);
        if (digits.length === 10) updates.npiNumber = digits;
        break;
      }
    }
  }
  return updates;
}
