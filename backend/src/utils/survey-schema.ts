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
  | 'rating'
  | 'info'
  | 'link'
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
  scaleMin?: number;
  scaleMax?: number;
  required?: boolean;
  [key: string]: unknown;
}

export interface NativeSurveySection {
  id: string;
  title?: string;
  questions: NativeSurveyQuestion[];
}

export interface NativeSurveySchema {
  version: number;
  sections: NativeSurveySection[];
}

const EDITABLE_NATIVE_TYPES = new Set([
  'single_choice',
  'multi_choice',
  'text',
  'long_text',
  'rating',
  'info',
  'link',
]);

/**
 * Validate and normalize the admin-editable native schema. Existing metadata
 * (including followUp) is preserved, but section/question ids must remain
 * unique because responses, CSV, and analytics use question ids as keys.
 */
export function validateNativeSurveySchema(value: unknown): NativeSurveySchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('questions must be a native survey schema object');
  }
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    throw new Error('questions.sections must contain at least one section');
  }

  const sectionIds = new Set<string>();
  const questionIds = new Set<string>();
  const sections = raw.sections.map((entry, sectionIndex) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`Section ${sectionIndex + 1} must be an object`);
    }
    const section = entry as Record<string, unknown>;
    const sectionId = typeof section.id === 'string' ? section.id.trim() : '';
    if (!sectionId) {
      throw new Error(`Section ${sectionIndex + 1} requires an id`);
    }
    if (sectionIds.has(sectionId)) {
      throw new Error(`Duplicate section id: ${sectionId}`);
    }
    sectionIds.add(sectionId);
    if (!Array.isArray(section.questions)) {
      throw new Error(`Section ${sectionId} requires a questions array`);
    }

    const questions = section.questions.map((item, questionIndex) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new Error(
          `Question ${questionIndex + 1} in section ${sectionId} must be an object`,
        );
      }
      const question = item as NativeSurveyQuestion;
      const id = typeof question.id === 'string' ? question.id.trim() : '';
      const type =
        typeof question.type === 'string' ? question.type.trim() : '';
      const prompt =
        typeof question.prompt === 'string' ? question.prompt.trim() : '';
      if (!id) throw new Error(`Question ${questionIndex + 1} requires an id`);
      if (questionIds.has(id)) throw new Error(`Duplicate question id: ${id}`);
      questionIds.add(id);
      if (!EDITABLE_NATIVE_TYPES.has(type)) {
        throw new Error(
          `Question ${id} has unsupported type: ${type || '(empty)'}`,
        );
      }
      if (!prompt) throw new Error(`Question ${id} requires a prompt`);

      if (type === 'single_choice' || type === 'multi_choice') {
        if (
          !Array.isArray(question.options) ||
          question.options.length === 0 ||
          question.options.some(
            (option) => typeof option !== 'string' || !option.trim(),
          )
        ) {
          throw new Error(`Question ${id} requires non-empty options`);
        }
        const uniqueOptions = new Set(
          question.options.map((option) => option.trim()),
        );
        if (uniqueOptions.size !== question.options.length) {
          throw new Error(`Question ${id} contains duplicate options`);
        }
        if (
          type === 'multi_choice' &&
          question.maxSelections !== undefined &&
          (!Number.isInteger(question.maxSelections) ||
            question.maxSelections < 1 ||
            question.maxSelections > question.options.length)
        ) {
          throw new Error(
            `Question ${id} maxSelections must be between 1 and the option count`,
          );
        }
      }

      if (type === 'rating') {
        const min = question.scaleMin ?? 1;
        const max = question.scaleMax ?? 5;
        if (
          !Number.isInteger(min) ||
          !Number.isInteger(max) ||
          min >= max ||
          max - min > 10
        ) {
          throw new Error(`Question ${id} requires a valid rating scale`);
        }
      }

      return {
        ...question,
        id,
        type,
        prompt,
        ...(Array.isArray(question.options)
          ? { options: question.options.map((option) => option.trim()) }
          : {}),
      };
    });

    return {
      ...(section as object),
      id: sectionId,
      ...(typeof section.title === 'string'
        ? { title: section.title.trim() }
        : {}),
      questions,
    };
  });

  const version =
    typeof raw.version === 'number' &&
    Number.isInteger(raw.version) &&
    raw.version > 0
      ? raw.version
      : 1;

  return { ...raw, version, sections } as NativeSurveySchema;
}

/**
 * Once responses exist, additions are safe, but existing answer keys cannot be
 * removed or reinterpreted. This keeps historical CSV/analytics mappings valid.
 */
export function findUnsafeAnsweredQuestionChanges(
  current: unknown,
  next: unknown,
): string[] {
  const currentById = new Map(
    listNativeSurveyQuestions(current)
      .filter((q): q is NativeSurveyQuestion & { id: string } => !!q.id)
      .map((q) => [q.id, q]),
  );
  const nextById = new Map(
    listNativeSurveyQuestions(next)
      .filter((q): q is NativeSurveyQuestion & { id: string } => !!q.id)
      .map((q) => [q.id, q]),
  );
  const changes: string[] = [];

  for (const [id, before] of currentById) {
    const after = nextById.get(id);
    if (!after) {
      changes.push(`${id}: removing an existing question`);
      continue;
    }
    if (before.type !== after.type) {
      changes.push(`${id}: changing question type`);
    }
    if ((before.prompt ?? '').trim() !== (after.prompt ?? '').trim()) {
      changes.push(`${id}: changing question prompt`);
    }
    if (
      JSON.stringify(before.options ?? []) !==
      JSON.stringify(after.options ?? [])
    ) {
      changes.push(`${id}: changing choice options`);
    }
    if (
      before.type === 'rating' &&
      (before.scaleMin ?? 1) !== (after.scaleMin ?? 1)
    ) {
      changes.push(`${id}: changing rating minimum`);
    }
    if (
      before.type === 'rating' &&
      (before.scaleMax ?? 5) !== (after.scaleMax ?? 5)
    ) {
      changes.push(`${id}: changing rating maximum`);
    }
  }
  return changes;
}

function flattenQuestionWithFollowUps(
  question: NativeSurveyQuestion,
): NativeSurveyQuestion[] {
  const followUp = question.followUp;
  if (!followUp || typeof followUp !== 'object' || Array.isArray(followUp)) {
    return [question];
  }
  const nested = (followUp as { question?: NativeSurveyQuestion }).question;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return [question];
  }
  return [question, ...flattenQuestionWithFollowUps(nested)];
}

/**
 * Flatten a stored survey `questions` blob into an ordered question list,
 * preserving type/options/maxSelections and expanding followUp sub-questions.
 * Returns `[]` for Jotform-sourced or malformed schemas.
 */
export function listNativeSurveyQuestions(
  questions: unknown,
): NativeSurveyQuestion[] {
  if (!questions || typeof questions !== 'object') return [];
  const q = questions as Record<string, unknown>;
  if (Array.isArray(q.sections)) {
    return (
      q.sections as Array<{ questions?: NativeSurveyQuestion[] }>
    ).flatMap((section) =>
      (section.questions ?? []).flatMap(flattenQuestionWithFollowUps),
    );
  }
  if (Array.isArray(questions)) {
    return (questions as NativeSurveyQuestion[]).flatMap(
      flattenQuestionWithFollowUps,
    );
  }
  return [];
}

/** Whether a stored `questions` blob has a usable native schema (vs Jotform-sourced/empty). */
export function hasNativeSurveySchema(questions: unknown): boolean {
  return listNativeSurveyQuestions(questions).some(
    (q) => typeof q.id === 'string' && q.id.trim().length > 0,
  );
}
