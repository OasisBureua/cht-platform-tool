import type { ReportInputs, ReportSourceInput } from '../../../../api/reports';

/** How the user can fill a missing source. */
export type ReportInputFix =
  | 'link-programs'
  | 'pull-transcript'
  | 'attach-kols'
  | 'sync-hubspot'
  | 'sync-platform'
  | 'upload-csv';

export type ReportInputRow = {
  key: string;
  /** Generate toggle this row belongs to. */
  source: string;
  label: string;
  detail: string;
  status: ReportSourceInput['status'];
  fetchedAt: string | null;
  fix?: ReportInputFix;
};

type SourceOption = { value: string; label: string };

/** Hub completeness key for a Generate toggle; only surveys differs. */
const completenessKey = (source: string) => (source === 'surveys' ? 'surveyResponses' : source);

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** CPR-51 — one row per source (plus transcripts / registrations), in toggle order. */
export function describeReportInputs(inputs: ReportInputs, sources: SourceOption[]): ReportInputRow[] {
  const c = inputs.inputCompleteness;
  const rows: ReportInputRow[] = [];
  const add = (
    source: string,
    key: string,
    label: string,
    entry: ReportSourceInput | undefined,
    ok: (entry: ReportSourceInput) => string,
    missing: string,
    fix?: ReportInputFix,
  ) => {
    if (!entry) return;
    const detail =
      entry.status === 'ok' ? ok(entry) : entry.status === 'error' ? 'Last sync failed' : missing;
    rows.push({
      key,
      source,
      label,
      detail,
      status: entry.status,
      fetchedAt: entry.fetchedAt,
      fix: entry.status === 'ok' ? undefined : fix,
    });
  };

  for (const { value, label } of sources) {
    switch (value) {
      case 'hubspot':
        add(value, value, label, c.hubspot, () => 'CRM data synced', 'No HubSpot data in this window', 'sync-hubspot');
        break;
      case 'linkedin':
      case 'meta':
      case 'youtube':
        add(
          value,
          value,
          label,
          c[value],
          (e) => count(e.rowCount, 'row'),
          'No data in this window',
          c[value]?.status === 'error' ? 'sync-platform' : 'upload-csv',
        );
        break;
      case 'sessions':
        add(
          value,
          value,
          label,
          c.sessions,
          (e) => count(e.rowCount, 'session'),
          'No sessions in this window',
          'link-programs',
        );
        if (c.sessions?.status === 'ok') {
          add(
            value,
            'transcripts',
            'Transcripts',
            c.transcripts,
            (e) => `${e.rowCount} of ${c.sessions.rowCount} sessions`,
            'Not pulled from Zoom yet',
            'pull-transcript',
          );
        }
        break;
      case 'attendance':
        add(
          value,
          value,
          label,
          c.attendance,
          () =>
            `${count(inputs.attendedCount ?? 0, 'attendee')}, ${inputs.attendeesWithProfile ?? 0} with profile details`,
          'No attendance in this window',
          'link-programs',
        );
        add(
          value,
          'registrations',
          'Registrations',
          c.registrations,
          (e) => count(e.rowCount, 'registration'),
          'None on the platform',
        );
        break;
      case 'kols':
        add(
          value,
          value,
          label,
          c.kols,
          (e) => `${count(e.rowCount, 'KOL')} attached`,
          'None attached. Speakers come from the transcript.',
          'attach-kols',
        );
        break;
      case 'surveys':
        add(value, value, label, c.surveyResponses, (e) => count(e.rowCount, 'response'), 'No responses in this window');
        break;
    }
  }
  return rows;
}

/** Toggles whose main source has data. */
export function sourcesWithData(inputs: ReportInputs, sources: SourceOption[]): string[] {
  return sources
    .filter(({ value }) => inputs.inputCompleteness[completenessKey(value)]?.status === 'ok')
    .map(({ value }) => value);
}

/** The collapsed one-line summary, counted in Generate toggles. */
export function summarizeReportInputs(
  inputs: ReportInputs,
  sources: SourceOption[],
): { withData: number; total: number; missing: string[]; transcriptsMissing: boolean } {
  const known = sources.filter(({ value }) => inputs.inputCompleteness[completenessKey(value)]);
  const withData = sourcesWithData(inputs, known);
  const missing = known.filter(({ value }) => !withData.includes(value)).map(({ label }) => label);
  // Sessions without transcripts still count as data; the line says so separately.
  const transcriptsMissing =
    withData.includes('sessions') && inputs.inputCompleteness.transcripts?.status !== 'ok';
  return { withData: withData.length, total: known.length, missing, transcriptsMissing };
}
