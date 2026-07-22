export type EditableQuestionType =
  'text' | 'long_text' | 'single_choice' | 'multi_choice' | 'rating' | 'info';

export type EditableSurveyQuestion = {
  id: string;
  type: EditableQuestionType;
  prompt: string;
  required?: boolean;
  options?: string[];
  maxSelections?: number;
  scaleMin?: number;
  scaleMax?: number;
  [key: string]: unknown;
};

export type EditableSurveySection = {
  id: string;
  title?: string;
  questions: EditableSurveyQuestion[];
};

export type EditableSurveySchema = {
  version: number;
  sections: EditableSurveySection[];
};

const QUESTION_TYPES = new Set<EditableQuestionType>([
  'text',
  'long_text',
  'single_choice',
  'multi_choice',
  'rating',
  'info',
]);

export function normalizeEditableSurveySchema(
  value: unknown,
): EditableSurveySchema {
  const raw =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const sections = Array.isArray(raw.sections)
    ? raw.sections
        .filter(
          (section): section is Record<string, unknown> =>
            !!section && typeof section === 'object' && !Array.isArray(section),
        )
        .map((section, sectionIndex) => ({
          id:
            typeof section.id === 'string' && section.id.trim()
              ? section.id
              : `section_${sectionIndex + 1}`,
          title: typeof section.title === 'string' ? section.title : '',
          questions: Array.isArray(section.questions)
            ? section.questions
                .filter(
                  (question): question is Record<string, unknown> =>
                    !!question &&
                    typeof question === 'object' &&
                    !Array.isArray(question),
                )
                .map((question, questionIndex) => ({
                  ...question,
                  id:
                    typeof question.id === 'string' && question.id.trim()
                      ? question.id
                      : `q_${sectionIndex + 1}_${questionIndex + 1}`,
                  type: (typeof question.type === 'string' &&
                  QUESTION_TYPES.has(question.type as EditableQuestionType)
                    ? question.type
                    : 'text') as EditableQuestionType,
                  prompt:
                    typeof question.prompt === 'string' ? question.prompt : '',
                  required: question.required !== false,
                  options: Array.isArray(question.options)
                    ? question.options.filter(
                        (option): option is string =>
                          typeof option === 'string',
                      )
                    : undefined,
                }))
            : [],
        }))
    : [];

  return {
    version:
      typeof raw.version === 'number' && Number.isInteger(raw.version)
        ? raw.version
        : 1,
    sections:
      sections.length > 0
        ? sections
        : [{ id: 'main', title: 'Questions', questions: [] }],
  };
}
