import type { SurveyQuestion } from '../api/surveys';

const IDENTITY_QUESTION_IDS = new Set([
  'name',
  'first_name',
  'firstname',
  'last_name',
  'lastname',
  'email',
]);

/** True when questions JSON is a native schema (not Jotform placeholder metadata). */
export function surveyHasNativeQuestions(questions: unknown): boolean {
  if (!questions || typeof questions !== 'object') return false;
  const q = questions as Record<string, unknown>;
  if (q.source === 'jotform') return false;
  if (Array.isArray(q.sections)) return true;
  return Array.isArray(questions);
}

export function isIdentitySurveyQuestion(question: SurveyQuestion): boolean {
  const id = String(question.id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (IDENTITY_QUESTION_IDS.has(id)) return true;
  if (question.type === 'email') return true;
  const prompt = String(question.prompt ?? '').toLowerCase();
  if (prompt.includes('email') && prompt.includes('@')) return true;
  return false;
}

export type NativeSurveySectionView = {
  id: string;
  title: string;
  questions: SurveyQuestion[];
};

/** Section list for progress UI (Section x of n). Falls back to one untitled section. */
export function listNativeSurveySections(
  questions: unknown,
): NativeSurveySectionView[] {
  if (!questions || typeof questions !== 'object') return [];
  const q = questions as Record<string, unknown>;
  if (Array.isArray(q.sections)) {
    return (q.sections as Array<{ id?: string; title?: string; questions?: SurveyQuestion[] }>)
      .map((section, index) => ({
        id: String(section.id ?? `section-${index + 1}`),
        title: String(section.title ?? `Section ${index + 1}`).trim() || `Section ${index + 1}`,
        questions: section.questions ?? [],
      }))
      .filter((section) => section.questions.length > 0);
  }
  if (Array.isArray(questions)) {
    return [
      {
        id: 'questions',
        title: 'Questions',
        questions: questions as SurveyQuestion[],
      },
    ];
  }
  return [];
}

export function listNativeSurveyQuestions(questions: unknown): SurveyQuestion[] {
  const sections = listNativeSurveySections(questions);
  if (sections.length > 0) {
    return sections.flatMap((section) => section.questions);
  }
  return [];
}
