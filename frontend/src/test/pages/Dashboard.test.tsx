import { beforeAll, describe, it, expect, vi } from 'vitest';
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
});
