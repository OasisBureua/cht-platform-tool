import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReportInputs, ReportSourceInput } from '../../api/reports';
import ReportsPanel from '../../pages/admin/content-hub/components/ReportsPanel';

const ALL = ['hubspot', 'linkedin', 'meta', 'youtube', 'sessions', 'attendance', 'kols', 'surveys'];

/** Report inputs per range; undefined means the check is still loading. */
let byRange: Record<number, ReportInputs | undefined> = {};
let placeholder = false;

const idle = { mutate: vi.fn(), isPending: false };

vi.mock('../../pages/admin/content-hub/lib/reportHooks', () => ({
  useCampaignReports: () => ({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useCreateReport: () => idle,
  useDownloadReport: () => idle,
  useRefreshCampaignData: () => idle,
  useRegenerateReport: () => idle,
  useReportRecipients: () => ({ data: [], isLoading: false }),
  useReportInputs: (_campaignId: string, days: number) => ({
    data: byRange[days],
    isLoading: !byRange[days],
    isError: false,
    isPlaceholderData: placeholder,
  }),
}));

vi.mock('../../pages/admin/content-hub/components/CampaignKolsCard', () => ({
  CampaignKolsCard: () => null,
}));

const entry = (ok: boolean): ReportSourceInput => ({
  fetchedAt: null,
  rowCount: ok ? 1 : 0,
  status: ok ? 'ok' : 'missing',
});

const inputs = (withData: string[]): ReportInputs => ({
  campaignId: 34,
  windowStart: null,
  windowEnd: '2026-10-20',
  sources: ALL,
  inputCompleteness: {
    ...Object.fromEntries(
      ALL.map((s) => [s === 'surveys' ? 'surveyResponses' : s, entry(withData.includes(s))]),
    ),
    transcripts: entry(true),
  },
  registeredCount: null,
  attendedCount: null,
  attendeesWithProfile: null,
});

const renderPanel = () =>
  render(
    <MemoryRouter>
      <ReportsPanel campaignId="34" linkedProgramCount={1} programHubPath={null} onGoToPrograms={() => {}} />
    </MemoryRouter>,
  );

const on = () =>
  screen
    .getAllByRole('checkbox')
    .filter((c) => c.getAttribute('aria-checked') === 'true')
    .map((c) => c.textContent);

const pickRange = (label: string) => fireEvent.click(screen.getByRole('tab', { name: label }));

const NOTE = /Turned off because they have no data/;

describe('Generate card sources (CPR-51)', () => {
  beforeEach(() => {
    byRange = {};
    placeholder = false;
  });

  it('re-applies the data check whenever the range changes', () => {
    byRange[30] = inputs(['sessions', 'surveys']);
    const view = renderPanel();
    expect(on()).toEqual(['Zoom sessions', 'Surveys']);
    expect(screen.getByText(NOTE)).toBeTruthy();

    // The 60-day check is still loading: nothing from the 30-day check carries over.
    pickRange('Last 60 days');
    expect(on()).toHaveLength(ALL.length);
    expect(screen.queryByText(NOTE)).toBeNull();

    byRange[60] = inputs(ALL);
    view.rerender(
      <MemoryRouter>
        <ReportsPanel
          campaignId="34"
          linkedProgramCount={1}
          programHubPath={null}
          onGoToPrograms={() => {}}
        />
      </MemoryRouter>,
    );
    expect(on()).toHaveLength(ALL.length);
    expect(screen.queryByText(NOTE)).toBeNull();

    pickRange('Last 30 days');
    expect(on()).toEqual(['Zoom sessions', 'Surveys']);
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it('ignores placeholder data from another range', () => {
    byRange[30] = inputs(['sessions']);
    placeholder = true;
    renderPanel();
    expect(on()).toHaveLength(ALL.length);
    expect(screen.queryByText(NOTE)).toBeNull();
  });

  it('keeps sources the admin picked by hand across ranges', () => {
    byRange[30] = inputs(['sessions', 'surveys']);
    byRange[60] = inputs(ALL);
    renderPanel();

    fireEvent.click(screen.getByRole('checkbox', { name: /HubSpot/ }));
    expect(on()).toEqual(['HubSpot', 'Zoom sessions', 'Surveys']);
    expect(screen.queryByText(NOTE)).toBeNull();

    pickRange('Last 60 days');
    expect(on()).toEqual(['HubSpot', 'Zoom sessions', 'Surveys']);
  });
});
