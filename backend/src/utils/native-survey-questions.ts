/** True when Survey.questions holds a native schema (not Jotform placeholder metadata). */
export function surveyQuestionsAreNative(questions: unknown): boolean {
  if (!questions || typeof questions !== 'object') return false;
  const q = questions as Record<string, unknown>;
  if (q.source === 'jotform') return false;
  if (Array.isArray(q.sections)) return true;
  return Array.isArray(questions);
}
