/** Survey types as admins see them. The type decides where a survey is used. */
export type SurveyTypeValue = 'INTAKE' | 'FEEDBACK' | 'PRE_TEST' | 'POST_TEST';

export const SURVEY_TYPE_OPTIONS: { value: SurveyTypeValue; label: string; help: string }[] = [
  {
    value: 'INTAKE',
    label: 'Registration survey',
    help: "Filled in when someone registers. The program's newest registration survey is the one used, and it appears in the Registration survey dropdowns.",
  },
  {
    value: 'FEEDBACK',
    label: 'Post-event survey',
    help: 'Sent after the session to verified attendees. Appears in the Post-event survey dropdowns.',
  },
  { value: 'PRE_TEST', label: 'Pre-test', help: 'Knowledge check before the session.' },
  { value: 'POST_TEST', label: 'Post-test', help: 'Knowledge check after the session.' },
];

export function surveyTypeLabel(type: string | null | undefined): string {
  return SURVEY_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type ?? 'Survey';
}
