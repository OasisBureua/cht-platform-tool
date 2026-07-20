/**
 * Shared native-survey schema normalizer.
 *
 * Native surveys store questions as `{ sections: [{ questions: [...] }] }`
 * (see native-survey-templates.ts). Some surveys are Jotform-sourced
 * (`{ source: 'jotform' }`) and carry no native question schema.
 *
 * Both the CSV exporter (survey-responses-csv.ts) and the response analytics
 * build on this single flattener so they agree on question ids, order,
 * prompts, types, and choice options — one source of truth.
 */

/** Native question types emitted by native-survey-templates.ts. Unknown/legacy values pass through. */
export type NativeSurveyQuestionType =
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'long_text'
  | 'info'
  | (string & {});

export interface NativeSurveyQuestion {
  id?: string;
  prompt?: string;
  /** Aggregation dispatch key (choice vs text vs info). Absent on legacy rows. */
  type?: NativeSurveyQuestionType;
  /** Allowed values for single_choice / multi_choice. */
  options?: string[];
  /** Cap for multi_choice selections (display/validation metadata). */
  maxSelections?: number;
  required?: boolean;
}

/**
 * Flatten a stored survey `questions` blob into an ordered question list,
 * preserving type/options/maxSelections. Returns `[]` for Jotform-sourced or
 * malformed schemas.
 */
export function listNativeSurveyQuestions(
  questions: unknown,
): NativeSurveyQuestion[] {
  if (!questions || typeof questions !== 'object') return [];
  const q = questions as Record<string, unknown>;
  if (Array.isArray(q.sections)) {
    return (q.sections as Array<{ questions?: NativeSurveyQuestion[] }>).flatMap(
      (section) => section.questions ?? [],
    );
  }
  if (Array.isArray(questions)) {
    return questions as NativeSurveyQuestion[];
  }
  return [];
}

/** Whether a stored `questions` blob has a usable native schema (vs Jotform-sourced/empty). */
export function hasNativeSurveySchema(questions: unknown): boolean {
  return listNativeSurveyQuestions(questions).some(
    (q) => typeof q.id === 'string' && q.id.trim().length > 0,
  );
}
