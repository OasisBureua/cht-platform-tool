import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reportInputsApi, type ReportInputs } from '../../api/reports';
import {
  describeReportInputs,
  sourcesWithData,
  summarizeReportInputs,
} from '../../pages/admin/content-hub/lib/reportInputs';

const get = vi.fn();

vi.mock('../../api/client', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

const sources = [
  { value: 'sessions', label: 'Zoom sessions' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'kols', label: 'Hub KOLs' },
  { value: 'surveys', label: 'Surveys' },
];

const inputs = (overrides: Partial<ReportInputs> = {}): ReportInputs => ({
  campaignId: 35,
  windowStart: '2026-09-16',
  windowEnd: '2026-10-16',
  sources: sources.map((s) => s.value),
  inputCompleteness: {
    sessions: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 1, status: 'ok' },
    transcripts: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 1, status: 'ok' },
    attendance: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 13, status: 'ok' },
    registrations: { fetchedAt: null, rowCount: 0, status: 'missing' },
    kols: { fetchedAt: null, rowCount: 0, status: 'missing' },
    surveyResponses: { fetchedAt: '2026-10-16T09:00:00Z', rowCount: 15, status: 'ok' },
    template: { fetchedAt: null, rowCount: 1, status: 'ok' },
  },
  registeredCount: 0,
  attendedCount: 13,
  attendeesWithProfile: 11,
  ...overrides,
});

describe('report inputs (CPR-51)', () => {
  beforeEach(() => get.mockReset());

  it('requests the campaign inputs with repeated sources', async () => {
    get.mockResolvedValueOnce({ data: inputs() });
    await reportInputsApi.get('35', { dateRangeDays: 30, sources: ['sessions', 'surveys'] });
    expect(get).toHaveBeenCalledWith('/admin/content-hub/campaigns/35/report-inputs', {
      params: { dateRangeDays: 30, sources: ['sessions', 'surveys'] },
      paramsSerializer: { indexes: null },
    });
  });

  it('describes each source in toggle order, with a fix for what is missing', () => {
    const rows = describeReportInputs(inputs(), sources);
    expect(rows.map((r) => [r.label, r.status, r.detail, r.fix])).toEqual([
      ['Zoom sessions', 'ok', '1 session', undefined],
      ['Transcripts', 'ok', '1 of 1 sessions', undefined],
      ['Attendance', 'ok', '13 attendees, 11 with profile details', undefined],
      ['Registrations', 'missing', 'None on the platform', undefined],
      ['Hub KOLs', 'missing', 'None attached. Speakers come from the transcript.', 'attach-kols'],
      ['Surveys', 'ok', '15 responses', undefined],
    ]);
  });

  it('lists the toggles that have data and summarizes what is missing', () => {
    expect(sourcesWithData(inputs(), sources)).toEqual(['sessions', 'attendance', 'surveys']);
    expect(summarizeReportInputs(inputs(), sources)).toEqual({
      withData: 3,
      total: 4,
      missing: ['Hub KOLs'],
    });
  });

  it('counts a missing transcript as missing even when sessions exist', () => {
    const data = inputs();
    data.inputCompleteness.transcripts = { fetchedAt: null, rowCount: 0, status: 'missing' };
    expect(summarizeReportInputs(data, sources).missing).toEqual(['Transcripts', 'Hub KOLs']);
    const transcript = describeReportInputs(data, sources).find((r) => r.key === 'transcripts');
    expect(transcript).toMatchObject({ detail: 'Not pulled from Zoom yet', fix: 'pull-transcript' });
  });

  it('skips transcripts when there are no sessions, and reports failed syncs', () => {
    const rows = describeReportInputs(
      inputs({
        inputCompleteness: {
          sessions: { fetchedAt: null, rowCount: 0, status: 'missing' },
          transcripts: { fetchedAt: null, rowCount: 0, status: 'missing' },
          youtube: { fetchedAt: null, rowCount: 0, status: 'error' },
        },
      }),
      [
        { value: 'sessions', label: 'Zoom sessions' },
        { value: 'youtube', label: 'YouTube' },
      ],
    );
    expect(rows.map((r) => [r.key, r.detail, r.fix])).toEqual([
      ['sessions', 'No sessions in this window', 'link-programs'],
      ['youtube', 'Last sync failed', 'upload-csv'],
    ]);
  });
});
