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

  it('requests every source for the date range', async () => {
    get.mockResolvedValueOnce({ data: inputs() });
    await reportInputsApi.get('35', { dateRangeDays: 30 });
    expect(get).toHaveBeenCalledWith('/admin/content-hub/campaigns/35/report-inputs', {
      params: { dateRangeDays: 30 },
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
      transcriptsMissing: false,
    });
  });

  it('flags missing transcripts apart from the sources when sessions exist', () => {
    const data = inputs();
    data.inputCompleteness.transcripts = { fetchedAt: null, rowCount: 0, status: 'missing' };
    expect(summarizeReportInputs(data, sources)).toEqual({
      withData: 3,
      total: 4,
      missing: ['Hub KOLs'],
      transcriptsMissing: true,
    });
    const transcript = describeReportInputs(data, sources).find((r) => r.key === 'transcripts');
    expect(transcript).toMatchObject({ detail: 'Not pulled from Zoom yet', fix: 'pull-transcript' });
  });

  it('skips transcripts when there are no sessions, and offers a retry for failed syncs', () => {
    const data = inputs({
      inputCompleteness: {
        sessions: { fetchedAt: null, rowCount: 0, status: 'missing' },
        transcripts: { fetchedAt: null, rowCount: 0, status: 'missing' },
        youtube: { fetchedAt: null, rowCount: 0, status: 'error' },
        linkedin: { fetchedAt: null, rowCount: 0, status: 'missing' },
      },
    });
    const options = [
      { value: 'sessions', label: 'Zoom sessions' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'linkedin', label: 'LinkedIn' },
    ];
    expect(describeReportInputs(data, options).map((r) => [r.key, r.detail, r.fix])).toEqual([
      ['sessions', 'No sessions in this window', 'link-programs'],
      ['youtube', 'Last sync failed', 'sync-platform'],
      ['linkedin', 'No data in this window', 'upload-csv'],
    ]);
    expect(summarizeReportInputs(data, options).transcriptsMissing).toBe(false);
  });

  describe('social posts (CPR-61)', () => {
    const options = [
      { value: 'hubspot', label: 'HubSpot' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'sessions', label: 'Zoom sessions' },
    ];
    const withSocial = (socialPosts: ReportInputs['socialPosts'], status: 'ok' | 'missing' = 'ok', rowCount = 3) =>
      inputs({
        inputCompleteness: {
          ...inputs().inputCompleteness,
          hubspot: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 1, status: 'ok' },
          youtube: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 4, status: 'ok' },
          socialPosts: { fetchedAt: '2026-10-20T12:00:00Z', rowCount, status },
        },
        socialPosts,
      });

    it('adds one line after the social toggles with linked posts per channel', () => {
      const rows = describeReportInputs(
        withSocial([
          { channel: 'youtube', linked: 3, withMetrics: 2 },
          { channel: 'linkedin', linked: 1, withMetrics: 1 },
        ]),
        options,
      );
      expect(rows.map((r) => r.key)).toEqual(['hubspot', 'youtube', 'socialPosts', 'sessions', 'transcripts']);
      expect(rows[2]).toMatchObject({
        label: 'Social posts',
        status: 'ok',
        detail: '4 posts linked (YouTube 3, LinkedIn 1), 3 with metrics in this window',
        sources: ['hubspot', 'youtube'],
      });
    });

    it('says when posts are linked without metrics, or none are linked', () => {
      const noMetrics = describeReportInputs(withSocial([{ channel: 'youtube', linked: 2, withMetrics: 0 }], 'missing', 0), options);
      expect(noMetrics.find((r) => r.key === 'socialPosts')).toMatchObject({
        status: 'missing',
        detail: '2 posts linked (YouTube 2), 0 with metrics in this window',
      });
      const none = describeReportInputs(withSocial([], 'missing', 0), options);
      expect(none.find((r) => r.key === 'socialPosts')?.detail).toBe('No posts linked to this campaign');
    });

    it('is left out on an older Hub and does not count as a source', () => {
      expect(describeReportInputs(inputs(), options).some((r) => r.key === 'socialPosts')).toBe(false);
      expect(summarizeReportInputs(withSocial([]), options).total).toBe(3);
    });
  });
});
