import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminSurveyCompare from '../../../pages/admin/AdminSurveyCompare';

const compareMock = vi.fn();
const candidatesMock = vi.fn();

vi.mock('../../../api/admin', () => ({
  adminApi: {
    compareSurveys: (...args: unknown[]) => compareMock(...args),
    listSurveyCompareCandidates: (...args: unknown[]) => candidatesMock(...args),
  },
}));

function renderCompare(initial = '/admin/surveys/compare') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/admin/surveys/compare" element={<AdminSurveyCompare />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSurveyCompare', () => {
  beforeEach(() => {
    compareMock.mockReset();
    candidatesMock.mockReset();
    candidatesMock.mockResolvedValue({
      totalMatching: 2,
      items: [
        {
          id: 'fb1',
          title: 'Feedback',
          type: 'FEEDBACK',
          isCustomized: false,
          responseCount: 3,
          program: { id: 'p1', title: 'Webinar One' },
        },
        {
          id: 'fb2',
          title: 'Feedback',
          type: 'FEEDBACK',
          isCustomized: false,
          responseCount: 5,
          program: { id: 'p2', title: 'Webinar Two' },
        },
      ],
    });
    compareMock.mockResolvedValue({
      columns: [
        {
          surveyId: 'fb1',
          title: 'Feedback',
          type: 'FEEDBACK',
          program: { id: 'p1', title: 'Webinar One' },
          responseCount: 3,
          completionRate: { eligible: 10, completed: 3, rate: 30 },
          averageEase: 4.1,
          easeByStage: [{ stage: 'access', average: 4.1, count: 3 }],
          nps: {
            score: 33,
            promoters: 2,
            passives: 0,
            detractors: 1,
            totalRated: 3,
          },
          hasNativeSchema: true,
          hasBetaInsights: true,
        },
        {
          surveyId: 'fb2',
          title: 'Feedback',
          type: 'FEEDBACK',
          program: { id: 'p2', title: 'Webinar Two' },
          responseCount: 5,
          completionRate: { eligible: 10, completed: 5, rate: 50 },
          averageEase: 3.9,
          easeByStage: [{ stage: 'access', average: 3.9, count: 5 }],
          nps: {
            score: 20,
            promoters: 2,
            passives: 2,
            detractors: 1,
            totalRated: 5,
          },
          hasNativeSchema: true,
          hasBetaInsights: true,
        },
      ],
      sharedQuestions: [],
      warnings: [],
    });
  });

  it('prompts to select two surveys and loads candidates from the API', async () => {
    renderCompare();

    expect(await screen.findByText('Select at least two surveys')).toBeInTheDocument();
    await waitFor(() => {
      expect(candidatesMock).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Webinar One/i)).toBeInTheDocument();
    expect(screen.getByText(/Webinar Two/i)).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(compareMock).not.toHaveBeenCalled();
  });

  it('loads compare table when two FEEDBACK surveys are selected via URL', async () => {
    renderCompare('/admin/surveys/compare?ids=fb1,fb2');

    await waitFor(() => {
      expect(compareMock).toHaveBeenCalledWith(['fb1', 'fb2']);
    });
    expect(await screen.findByTestId('survey-compare-table')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('NPS')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('toggles selection from the picker', async () => {
    renderCompare();

    const boxes = await screen.findAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);

    await waitFor(() => {
      expect(compareMock).toHaveBeenCalled();
    });
    expect(await screen.findByTestId('survey-compare-table')).toBeInTheDocument();
  });

  it('searches candidates on the backend when the query changes', async () => {
    renderCompare();
    await screen.findByTestId('survey-compare-picker-list');

    candidatesMock.mockResolvedValueOnce({
      totalMatching: 1,
      items: [
        {
          id: 'fb2',
          title: 'Feedback',
          type: 'FEEDBACK',
          isCustomized: false,
          responseCount: 5,
          program: { id: 'p2', title: 'Webinar Two' },
        },
      ],
    });

    const search = screen.getByRole('searchbox', {
      name: /search post-event surveys/i,
    });
    fireEvent.change(search, { target: { value: 'Webinar Two' } });

    await waitFor(() => {
      expect(candidatesMock).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'Webinar Two' }),
      );
    });
    expect(
      await screen.findByText(/WEBINAR TWO - POST EVENT \(FEEDBACK\)/i),
    ).toBeInTheDocument();
  });
});
