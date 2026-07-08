import { BadRequestException } from '@nestjs/common';

/** Keys learners must not supply — identity comes from the auth session. */
const IDENTITY_ANSWER_KEYS = new Set([
  'userid',
  'user_id',
  'programid',
  'program_id',
  'email',
  'name',
  'firstname',
  'first_name',
  'lastname',
  'last_name',
]);

function normalizeAnswerKey(key: string): string {
  return key.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function assertNoIdentityFieldsInSurveyAnswers(
  answers: Record<string, unknown>,
): void {
  for (const key of Object.keys(answers)) {
    if (IDENTITY_ANSWER_KEYS.has(normalizeAnswerKey(key))) {
      throw new BadRequestException(
        'Survey answers must not include identity fields (name, email, user id).',
      );
    }
  }
}

export function stripIdentityFieldsFromSurveyAnswers(
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (IDENTITY_ANSWER_KEYS.has(normalizeAnswerKey(key))) continue;
    out[key] = value;
  }
  return out;
}
