import { listNativeSurveyQuestions } from './survey-questions';
import type { SurveyQuestion } from '../api/surveys';

const QUESTION_LABEL_BY_ID = new Map<string, string>();

function rememberQuestions(questions: unknown) {
  for (const q of listNativeSurveyQuestions(questions)) {
    const id = String(q.id ?? '').trim();
    if (id && q.prompt) QUESTION_LABEL_BY_ID.set(id, String(q.prompt));
  }
}

export function formatSurveyAnswerValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function surveyAnswersToRows(
  answers: unknown,
  questionsSchema?: unknown,
): Array<{ label: string; value: string }> {
  if (questionsSchema) rememberQuestions(questionsSchema);
  if (!answers || typeof answers !== 'object') return [];
  const record = answers as Record<string, unknown>;
  return Object.entries(record).map(([key, value]) => ({
    label: QUESTION_LABEL_BY_ID.get(key) ?? key.replace(/_/g, ' '),
    value: formatSurveyAnswerValue(value),
  }));
}

export function registrationStatusLabel(status: string): string {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'PENDING') return 'Pending';
  if (status === 'REJECTED') return 'Denied';
  return status;
}

export function registrationStatusClass(status: string): string {
  if (status === 'APPROVED') return 'bg-green-100 text-green-800';
  if (status === 'PENDING') return 'bg-amber-50 text-amber-800';
  if (status === 'REJECTED') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-600';
}

export function attendanceStatusLabel(att: string | null | undefined): string {
  if (att === 'VERIFIED') return 'Verified';
  if (att === 'DENIED') return 'Denied';
  if (att === 'PENDING_VERIFICATION') return 'Pending';
  return '-';
}

/** Admin list labels, e.g. PROGRAM 1 - REGISTRATION (INTAKE). */
export function adminSurveyDisplayTitle(
  programTitle: string | null | undefined,
  surveyType: string,
  fallbackTitle?: string,
): string {
  const program =
    programTitle?.trim() ||
    fallbackTitle?.split(' - ')[0]?.trim() ||
    'Survey';
  const programLabel = program.toUpperCase();

  if (surveyType === 'INTAKE') {
    return `${programLabel} - REGISTRATION (INTAKE)`;
  }
  if (surveyType === 'FEEDBACK') {
    return `${programLabel} - POST EVENT (FEEDBACK)`;
  }

  const typeLabel = surveyType.replace(/_/g, ' ').toUpperCase();
  return `${programLabel} - ${typeLabel}`;
}

export type { SurveyQuestion };
