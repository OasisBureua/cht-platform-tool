import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { SurveyStudioOverview } from '../../../components/admin/survey-workspace/SurveyStudioOverview';
import type { Survey } from '../../../api/surveys';

vi.mock('../../../api/admin', () => ({
  adminApi: {
    getSurveyAnalytics: vi.fn().mockResolvedValue({
      survey: { id: 'sv1', title: 'Post-event', type: 'FEEDBACK', program: null },
      analytics: {
        surveyType: 'FEEDBACK',
        hasNativeSchema: true,
        totals: {
          totalResponses: 4,
          uniqueRespondents: 4,
          firstResponseAt: '2026-07-10T00:00:00.000Z',
          lastResponseAt: '2026-07-12T00:00:00.000Z',
          completionRate: { eligible: 10, completed: 4, rate: 40 },
          score: null,
        },
        timeSeries: [],
        questions: [],
        segments: null,
      },
    }),
  },
}));

const survey: Survey = {
  id: 'sv1',
  programId: 'p1',
  title: 'Post-event feedback',
  description: 'Tell us how it went.',
  questions: {},
  type: 'FEEDBACK',
  required: true,
  isCustomized: true,
  schemaVersion: 2,
  responseCount: 4,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
  program: {
    id: 'p1',
    title: 'HCP Beta Webinar',
    sponsorName: 'Acme',
    startDate: '2026-07-01T17:00:00.000Z',
  },
};

function renderOverview(onOpenTab = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SurveyStudioOverview
          survey={survey}
          responseCount={4}
          lastResponseAt="2026-07-12T00:00:00.000Z"
          onOpenTab={onOpenTab}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SurveyStudioOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows mini KPIs, webinar link, and quick actions', async () => {
    const onOpenTab = vi.fn();
    renderOverview(onOpenTab);

    expect(screen.getByTestId('survey-studio-overview')).toBeInTheDocument();
    expect(screen.getByText('Responses')).toBeInTheDocument();
    expect(screen.getByText('HCP Beta Webinar')).toBeInTheDocument();
    expect(screen.getByText('Open program hub')).toHaveAttribute(
      'href',
      '/admin/programs/p1/hub?tab=surveys',
    );
    expect(screen.getByText('Customized')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /view results/i }));
    expect(onOpenTab).toHaveBeenCalledWith('results');

    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onOpenTab).toHaveBeenCalledWith('settings');

    expect(await screen.findByText('40%')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /compare webinars/i }),
    ).toHaveAttribute('href', '/admin/surveys/compare?ids=sv1');
  });

  it('hides Compare webinars for non-FEEDBACK surveys', () => {
    const intake: Survey = { ...survey, id: 'intake-1', type: 'INTAKE', title: 'Registration' };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SurveyStudioOverview
            survey={intake}
            responseCount={2}
            onOpenTab={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(
      screen.queryByRole('link', { name: /compare webinars/i }),
    ).not.toBeInTheDocument();
  });
});
