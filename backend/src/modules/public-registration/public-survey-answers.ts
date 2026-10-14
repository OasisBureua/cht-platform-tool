import {
  listNativeSurveyQuestions,
  type NativeSurveyQuestion,
} from '../../utils/survey-schema';
import { stripIdentityFieldsFromSurveyAnswers } from '../../utils/survey-answer-sanitizer';

/** Longest free-text answer accepted from a public (no login) submission. */
export const MAX_TEXT_ANSWER = 5000;

const NO_ANSWER_TYPES = new Set(['info', 'link']);

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

/** Question ids that only apply when their parent's answer triggers them. */
function followUpIds(schema: unknown): Set<string> {
  const ids = new Set<string>();
  const top = new Set(
    (
      (schema as { sections?: Array<{ questions?: NativeSurveyQuestion[] }> })
        ?.sections ?? []
    ).flatMap((s) => (s.questions ?? []).map((q) => q.id)),
  );
  for (const q of listNativeSurveyQuestions(schema)) {
    if (q.id && !top.has(q.id)) ids.add(q.id);
  }
  return ids;
}

/**
 * Check a public submission against the survey's native schema. Unknown keys
 * and answers to info/link blocks are dropped; identity fields are stripped
 * (the registrant's name and email come from their registration). Returns the
 * clean answers, or the list of problems.
 */
export function validatePublicSurveyAnswers(
  schema: unknown,
  raw: unknown,
): { answers: Record<string, unknown> } | { errors: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { errors: ['Answers must be an object.'] };
  }
  const input = stripIdentityFieldsFromSurveyAnswers(
    raw as Record<string, unknown>,
  );
  const followUps = followUpIds(schema);
  const answers: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const q of listNativeSurveyQuestions(schema)) {
    const id = q.id?.trim();
    if (!id || NO_ANSWER_TYPES.has(String(q.type))) continue;
    const label = q.prompt?.trim() || id;
    const value = input[id];

    if (isEmpty(value)) {
      if (q.required && !followUps.has(id))
        errors.push(`"${label}" is required.`);
      continue;
    }

    const options = Array.isArray(q.options) ? q.options : null;
    switch (q.type) {
      case 'single_choice':
        if (
          typeof value !== 'string' ||
          (options && !options.includes(value))
        ) {
          errors.push(`"${label}": choose one of the listed options.`);
          continue;
        }
        break;
      case 'multi_choice': {
        const picked = Array.isArray(value) ? value : [value];
        if (
          !picked.every(
            (v) => typeof v === 'string' && (!options || options.includes(v)),
          )
        ) {
          errors.push(`"${label}": choose from the listed options.`);
          continue;
        }
        if (
          typeof q.maxSelections === 'number' &&
          picked.length > q.maxSelections
        ) {
          errors.push(`"${label}": choose at most ${q.maxSelections}.`);
          continue;
        }
        answers[id] = picked;
        continue;
      }
      case 'rating': {
        const n = typeof value === 'number' ? value : Number(value);
        const min = typeof q.scaleMin === 'number' ? q.scaleMin : -Infinity;
        const max = typeof q.scaleMax === 'number' ? q.scaleMax : Infinity;
        if (!Number.isFinite(n) || n < min || n > max) {
          errors.push(`"${label}": enter a value in the scale.`);
          continue;
        }
        answers[id] = n;
        continue;
      }
      default:
        if (typeof value !== 'string' || value.length > MAX_TEXT_ANSWER) {
          errors.push(
            `"${label}": enter text up to ${MAX_TEXT_ANSWER} characters.`,
          );
          continue;
        }
    }
    answers[id] = typeof value === 'string' ? value.trim() : value;
  }
  return errors.length ? { errors } : { answers };
}
