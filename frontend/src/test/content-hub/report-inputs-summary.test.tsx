import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReportInputs } from '../../api/reports';
import { ReportInputsSummary } from '../../pages/admin/content-hub/components/ReportInputsSummary';

const sourceOptions = [
  { value: 'sessions', label: 'Zoom sessions' },
  { value: 'kols', label: 'Hub KOLs' },
  { value: 'surveys', label: 'Surveys' },
];

const inputs: ReportInputs = {
  campaignId: 34,
  windowStart: '2026-09-16',
  windowEnd: '2026-10-16',
  sources: [],
  inputCompleteness: {
    sessions: { fetchedAt: '2026-10-15T23:00:00Z', rowCount: 1, status: 'ok' },
    transcripts: { fetchedAt: null, rowCount: 0, status: 'missing' },
    kols: { fetchedAt: null, rowCount: 0, status: 'missing' },
    surveyResponses: { fetchedAt: null, rowCount: 0, status: 'missing' },
  },
  registeredCount: null,
  attendedCount: null,
  attendeesWithProfile: null,
};

const renderSummary = (programHubPath: string | null) =>
  render(
    <MemoryRouter>
      <ReportInputsSummary
        campaignId="34"
        inputs={inputs}
        isLoading={false}
        isError={false}
        sourceOptions={sourceOptions}
        selected={['sessions']}
        autoOff={['Hub KOLs', 'Surveys']}
        programHubPath={programHubPath}
      />
    </MemoryRouter>,
  );

describe('ReportInputsSummary (CPR-51)', () => {
  it('shows one line until expanded', () => {
    renderSummary('/admin/programs/p1/hub');
    expect(screen.getByText('1 of 3 sources have data')).toBeTruthy();
    expect(screen.getByText(/missing: Transcripts, Hub KOLs, Surveys/)).toBeTruthy();
    expect(screen.getByText(/Turned off because they have no data: Hub KOLs, Surveys/)).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Report inputs' })).toBeNull();
  });

  it('links each missing source to where it can be filled', () => {
    renderSummary('/admin/programs/p1/hub');
    fireEvent.click(screen.getByRole('button', { name: /Details/ }));
    expect(screen.getByRole('link', { name: 'Pull from Zoom' }).getAttribute('href')).toBe(
      '/admin/programs/p1/hub',
    );
    expect(screen.getByRole('button', { name: 'Attach KOLs' })).toBeTruthy();
    expect(screen.getAllByText(/not included/)).toHaveLength(2);
  });

  it('sends the transcript fix to the Programs tab when several programs are linked', () => {
    renderSummary(null);
    fireEvent.click(screen.getByRole('button', { name: /Details/ }));
    expect(screen.getByRole('link', { name: 'Open programs' }).getAttribute('href')).toBe('/?tab=programs');
  });
});
