import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../../pages/Dashboard';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u-1', firstName: 'Jimmy', email: 'jimmy@example.com' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}));

vi.mock('../../api/webinars', () => ({
  webinarsApi: { list: vi.fn(async () => []), listOfficeHours: vi.fn(async () => []) },
}));

vi.mock('../../api/dashboard', () => ({
  dashboardApi: {
    getEarnings: vi.fn(async () => ({ totalEarnings: 150, pendingEarnings: 0, paidEarnings: 150 })),
    getStats: vi.fn(async () => ({
      activitiesCompleted: 3,
      activitiesInProgress: 0,
      surveysCompleted: 2,
      cmeCreditsEarned: 4,
      completionRate: 1,
    })),
  },
}));

const progressMock = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('../../api/programs', () => ({
  programsApi: { getMyPostEventProgress: vi.fn(async () => progressMock.items) },
}));

vi.mock('../../api/surveys', () => ({
  surveysApi: { getAll: vi.fn(async () => ({ active: [] })) },
}));

vi.mock('../../api/catalog', () => ({
  catalogApi: {
    getTags: vi.fn(async () => ({ biomarker: ['HER2'] })),
    getClips: vi.fn(async () => ({
      items: [
        {
          id: 'clip-1',
          title: 'Surgical De-escalation After DESTINY-Breast11?',
          youtube_url: 'https://www.youtube.com/watch?v=6nULi7cFYK4',
          thumbnail_url: 'https://i.ytimg.com/vi/6nULi7cFYK4/hqdefault.jpg',
        },
      ],
      total: 1,
    })),
    getPlaylists: vi.fn(async () => [
      {
        id: 'PL-1',
        title: 'Cleopatra, DESTINY-Breast09 & What Comes Next',
        thumbnailUrl: 'https://i.ytimg.com/vi/iqQ6z4nzvyE/hqdefault.jpg',
        videoCount: 7,
      },
    ]),
  },
}));

// The disease-area rows fetch their own data; they are not under test here.
vi.mock('../../components/content/BiomarkerConversationRow', () => ({
  BIOMARKER_CAROUSEL_IDS: [],
  BiomarkerConversationRow: () => null,
}));

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    progressMock.items = [];
  });

  beforeAll(() => {
    // jsdom has no matchMedia. Report reduced motion so the Featured
    // carousel stays on its first slide instead of auto-advancing.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
  });

  it('shows earnings and activity in the overview', async () => {
    renderDashboard();
    const earnings = (await screen.findByText('Earnings')).closest('a')!;
    expect(earnings).toHaveAttribute('href', '/app/earnings');
    expect(await within(earnings).findByText('$150.00')).toBeInTheDocument();
    expect(await screen.findByText('2 surveys · 4 CME')).toBeInTheDocument();
  });

  it('shows the empty states when nothing is scheduled or due', async () => {
    renderDashboard();
    expect(await screen.findByText('Nothing on the calendar yet')).toBeInTheDocument();
    expect(
      await screen.findByText('None right now. A survey appears here after you attend a live program.'),
    ).toBeInTheDocument();
  });

  it('orders the rows: recently added, playlists, then the podcast network', async () => {
    renderDashboard();
    const recent = await screen.findByRole('heading', { name: 'Recently added' });
    const playlists = await screen.findByRole('heading', { name: 'Playlists' });
    const podcasts = screen.getByRole('heading', { name: 'Podcast network' });
    expect(recent.compareDocumentPosition(playlists) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(playlists.compareDocumentPosition(podcasts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the playlist count on the cover and links each show inside the app', async () => {
    renderDashboard();
    expect(await screen.findByText('7 videos')).toBeInTheDocument();
    const podcastRow = screen.getByRole('heading', { name: 'Podcast network' }).closest('section')!;
    const show = within(podcastRow).getByRole('link', { name: /Breast Friends/ });
    expect(show).toHaveAttribute('href', '/app/podcast-network/breast-friends');
  });

  it('leads the featured conversation with Play', async () => {
    renderDashboard();
    const featured = await screen.findByLabelText('Featured highlights');
    const play = await within(featured).findByRole('link', { name: 'Play' });
    expect(play).toHaveAttribute('href', expect.stringMatching(/^\/app\/clip\//));
  });

  it('shows a step-map card for a session with an unpaid honorarium', async () => {
    progressMock.items = [
      {
        programId: 'beta-pay',
        title: 'CHM Beta Test - HCPs',
        zoomSessionType: 'WEBINAR',
        startDate: '2026-10-30T00:00:00.000Z',
        hasSurvey: true,
        hasHonorarium: true,
        nativeSurvey: true,
        feedbackSurveyId: 'svy-beta-pay',
        attendance: 'VERIFIED',
        surveyAcknowledged: false,
        surveySubmitted: false,
        surveyDraftSaved: true,
        paymentInfoConfirmed: false,
        paymentStatus: null,
        payoutReady: false,
      },
    ];
    renderDashboard();
    const card = (await screen.findByRole('heading', { name: 'CHM Beta Test - HCPs' })).closest('section')!;
    expect(within(card).getByRole('link', { name: /Finish payment setup/ })).toHaveAttribute(
      'href',
      '/app/live/beta-pay?step=payment',
    );
    const [desktop] = within(card).getAllByRole('list', { hidden: true });
    expect(within(desktop).getByRole('link', { name: /Step 2 of 4: Survey, complete/ })).toHaveAttribute(
      'href',
      '/app/live/beta-pay?step=survey',
    );
    expect(
      within(desktop).getByRole('link', { name: /Step 3 of 4: Payment info, needs attention/ }),
    ).toHaveAttribute('aria-current', 'step');
  });

  it('shows no step-map card when every honorarium is paid', async () => {
    renderDashboard();
    await screen.findByText('Earnings');
    expect(screen.queryByText('Honorarium steps')).toBeNull();
  });
});
