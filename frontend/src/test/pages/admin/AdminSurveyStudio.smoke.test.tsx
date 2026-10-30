import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdminSurveyStudio from '../../../pages/admin/AdminSurveyStudio';

vi.mock('../../../api/surveys', () => ({
  surveysApi: {
    getById: vi.fn().mockResolvedValue({
      id: 'sv1',
      programId: 'p1',
      title: 'Feedback',
      description: 'Desc',
      questions: {
        sections: [
          {
            id: 'main',
            questions: [
              { id: 'q1', type: 'long_text', prompt: 'Comments?', required: false },
            ],
          },
        ],
      },
      type: 'FEEDBACK',
      required: true,
      schemaVersion: 1,
      responseCount: 2,
      isCustomized: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      program: { id: 'p1', title: 'Beta Webinar' },
    }),
  },
}));

vi.mock('../../../api/admin', () => ({
  adminApi: {
    listSurveyResponses: vi.fn().mockResolvedValue({
      survey: { id: 'sv1', title: 'Feedback', type: 'FEEDBACK', questions: {} },
      responses: [
        {
          id: 'r1',
          submissionId: null,
          submittedAt: '2026-01-02T12:00:00.000Z',
          answers: {},
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 2 },
    }),
    getSurveyAnalytics: vi.fn().mockResolvedValue({
      survey: { id: 'sv1', title: 'Feedback', type: 'FEEDBACK', program: null },
      analytics: {
        surveyType: 'FEEDBACK',
        hasNativeSchema: true,
        totals: {
          totalResponses: 2,
          uniqueRespondents: 2,
          firstResponseAt: null,
          lastResponseAt: '2026-01-02T12:00:00.000Z',
          completionRate: { eligible: 5, completed: 2, rate: 40 },
          score: null,
        },
        timeSeries: [],
        questions: [],
        segments: null,
      },
    }),
    downloadSurveyResponsesCsv: vi.fn(),
  },
}));

// Heavy child panels — keep smoke focused on shell + URL tabs.
vi.mock('../../../pages/admin/AdminEditSurvey', () => ({
  AdminEditSurveyForm: ({ sections }: { sections: string }) => (
    <div data-testid={`edit-${sections}`}>editor:{sections}</div>
  ),
}));
vi.mock('../../../pages/admin/AdminSurveyResponses', () => ({
  default: () => <div data-testid="responses-panel">responses</div>,
}));
vi.mock('../../../components/admin/survey-analytics/SurveyAnalyticsPanel', () => ({
  SurveyAnalyticsPanel: () => <div data-testid="results-panel">results</div>,
}));

function renderStudio(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/surveys/:id" element={<AdminSurveyStudio />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSurveyStudio smoke (SCRUM-291 AC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens overview by default and switches tabs via URL-backed control', async () => {
    renderStudio('/admin/surveys/sv1');

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      /BETA WEBINAR/i,
    );
    expect(screen.getByTestId('survey-studio-overview')).toBeInTheDocument();
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'id',
      'survey-studio-panel-overview',
    );

    fireEvent.click(screen.getByRole('tab', { name: /preview/i }));
    await waitFor(() => {
      expect(screen.getByRole('tabpanel')).toHaveAttribute(
        'id',
        'survey-studio-panel-preview',
      );
    });
    expect(screen.getByText(/Participant preview/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /results/i }));
    expect(await screen.findByTestId('results-panel')).toBeInTheDocument();
  });

  it('respects ?tab= from deep links (edit/responses redirects)', async () => {
    renderStudio('/admin/surveys/sv1?tab=questions');
    expect(await screen.findByTestId('edit-questions')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /questions/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('keeps breadcrumb back to the survey list (filters live on that URL)', async () => {
    renderStudio('/admin/surveys/sv1?tab=preview');
    const back = await screen.findByRole('link', { name: /surveys/i });
    expect(back).toHaveAttribute('href', '/admin/surveys');
  });
});
