import { listNativeSurveyQuestions } from './survey-schema';

/**
 * Excel on Windows often opens CSVs as Windows-1252 unless a UTF-8 BOM is
 * present. Without it, UTF-8 en dashes (–) render as mojibake (`â€“`).
 * Prepend this so Excel picks UTF-8; also normalize fancy dashes to ASCII
 * for tools that still ignore encoding.
 */
export const UTF8_CSV_BOM = '\uFEFF';

/** Map common Unicode punctuation that breaks CSV-in-Excel to ASCII. */
export function normalizeCsvText(value: string): string {
  return value
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // hyphens / dashes
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"') // double quotes
    .replace(/\u2026/g, '...') // ellipsis
    .replace(/\u00A0/g, ' '); // non-breaking space
}

function formatAnswerValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) {
    return normalizeCsvText(value.map((v) => String(v)).join(', '));
  }
  if (typeof value === 'object') {
    return normalizeCsvText(JSON.stringify(value));
  }
  return normalizeCsvText(String(value));
}

function csvEscape(value: string): string {
  const normalized = normalizeCsvText(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
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
  schemaVersion?: number;
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
    'schema_version',
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
      String(row.schemaVersion ?? ''),
      ...questionIds.map((id) => formatAnswerValue(row.answers?.[id])),
    ];
    lines.push(cells.map((c) => csvEscape(String(c))).join(','));
  }

  return `${UTF8_CSV_BOM}${lines.join('\n')}\n`;
}

export function surveyResponsesCsvFilename(
  programTitle: string,
  surveyType: string,
): string {
  const programSlug = slugifyFilenamePart(programTitle) || 'survey';
  const typeSlug =
    surveyType === 'INTAKE'
      ? 'registration'
      : surveyType === 'FEEDBACK'
        ? 'post-event'
        : slugifyFilenamePart(surveyType) || 'survey';
  return `${programSlug}-${typeSlug}-responses.csv`;
}
