type SurveyQuestion = {
  id?: string;
  prompt?: string;
};

function listNativeSurveyQuestions(questions: unknown): SurveyQuestion[] {
  if (!questions || typeof questions !== 'object') return [];
  const q = questions as Record<string, unknown>;
  if (Array.isArray(q.sections)) {
    return (q.sections as Array<{ questions?: SurveyQuestion[] }>).flatMap(
      (section) => section.questions ?? [],
    );
  }
  if (Array.isArray(questions)) {
    return questions as SurveyQuestion[];
  }
  return [];
}

function formatAnswerValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function slugifyFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export type SurveyResponseCsvRow = {
  submittedAt: string;
  answers: Record<string, unknown>;
  user: {
    email: string;
    firstName: string;
    lastName: string;
    specialty?: string | null;
  };
  registration?: {
    status: string;
    postEventAttendanceStatus?: string;
  } | null;
};

export function buildSurveyResponsesCsv(input: {
  surveyTitle: string;
  surveyType: string;
  questionsSchema: unknown;
  responses: SurveyResponseCsvRow[];
}): string {
  const labelById = new Map<string, string>();
  const orderedIds: string[] = [];
  for (const q of listNativeSurveyQuestions(input.questionsSchema)) {
    const id = String(q.id ?? '').trim();
    if (!id || labelById.has(id)) continue;
    labelById.set(id, String(q.prompt ?? id).trim() || id);
    orderedIds.push(id);
  }

  const extraIds = new Set<string>();
  for (const row of input.responses) {
    for (const key of Object.keys(row.answers ?? {})) {
      if (!labelById.has(key)) extraIds.add(key);
    }
  }
  const questionIds = [...orderedIds, ...Array.from(extraIds).sort()];

  const includeAttendance = input.surveyType === 'FEEDBACK';
  const headers = [
    'first_name',
    'last_name',
    'email',
    'specialty',
    'registration_status',
    ...(includeAttendance ? ['attendance_status'] : []),
    'submitted_at',
    ...questionIds.map((id) => labelById.get(id) ?? id),
  ];

  const lines = [headers.map(csvEscape).join(',')];

  for (const row of input.responses) {
    const cells = [
      row.user.firstName ?? '',
      row.user.lastName ?? '',
      row.user.email ?? '',
      row.user.specialty ?? '',
      row.registration?.status ?? '',
      ...(includeAttendance
        ? [row.registration?.postEventAttendanceStatus ?? '']
        : []),
      row.submittedAt,
      ...questionIds.map((id) => formatAnswerValue(row.answers?.[id])),
    ];
    lines.push(cells.map((c) => csvEscape(String(c))).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export function surveyResponsesCsvFilename(
  surveyTitle: string,
  surveyType: string,
): string {
  const slug = slugifyFilenamePart(surveyTitle) || 'survey';
  const type = slugifyFilenamePart(surveyType) || 'responses';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${type}-responses-${date}.csv`;
}
