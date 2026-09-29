import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import AppSidebar from '../../components/navigation/AppSidebar';
import KolNetwork from '../../pages/KolNetwork';
import KolProfilePage from '../../pages/public/KolProfilePage';
import { PodcastChannel } from '../../components/podcasts/PodcastChannel';
import Podcasts from '../../pages/Podcasts';
import { PODCAST_SHOWS } from '../../data/podcastsCatalog';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 'u-1', firstName: 'Jimmy' }, logout: vi.fn() }),
}));

const RUGO = {
  id: 'hope-rugo',
  name: 'Dr. Hope Rugo',
  role: 'Director, Breast Oncology',
  bio: 'Dr. Rugo leads breast cancer research at City of Hope.',
  education: 'UCSF (MD)',
  institution: 'City of Hope',
  stateCode: 'CA',
  photoUrl: 'https://example.org/rugo.jpg',
  intel: {
    aiBrief: { whoTheyAre: 'AI SUMMARY TEXT', focus: 'AI focus', chmContext: 'AI context' },
    researchHighlights: 'Research highlight text',
    awards: ['An award'],
  },
};

vi.mock('../../hooks/useKolDirectory', () => ({
  useKolDirectory: () => ({
    regions: [{ id: 'CA', title: 'California', entries: [RUGO] }],
    total: 1,
    institutions: ['City of Hope'],
    loadState: 'ready',
  }),
}));

vi.mock('../../hooks/useKolProfile', () => ({
  useKolProfile: () => ({
    region: { id: 'CA', title: 'California', entries: [RUGO] },
    entry: RUGO,
    loadState: 'ready',
  }),
}));

vi.mock('../../components/kol/KolCatalogContentSection', () => ({
  KolCatalogContentSection: () => <div data-testid="kol-catalog" />,
}));

vi.mock('../../hooks/usePodcastYouTubeEpisodes', () => {
  const data = {
    showTitle: 'Breast Friends',
    episodes: [
      {
        num: 'Ep. 9',
        title: 'The Breast Friends Podcast Ep. 9 | Humanizing Cancer Care',
        guests: 'Prof. Gabriella Pravettoni',
        date: 'Sep 1, 2026',
        dateIso: '2026-09-01',
        duration: '48:10',
        videoId: 'J88wBHM-AEY',
        youtubeUrl: 'https://www.youtube.com/watch?v=J88wBHM-AEY',
      },
    ],
  };
  return {
    usePodcastEpisodes: () => ({ isLoading: false, isError: false, data }),
    podcastEpisodesQuery: (showId: string | undefined, sort: string) => ({
      queryKey: ['podcast', 'episodes', showId, sort],
      queryFn: async () => data,
      enabled: !!showId,
    }),
  };
});

vi.mock('../../components/podcasts/PodcastSeriesSection', async (orig) => ({
  ...(await orig<typeof import('../../components/podcasts/PodcastSeriesSection')>()),
  useShowLatestEpisode: () => null,
}));

function wrap(ui: ReactNode, path = '/app/home') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('App sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  it('collapses to icons, remembers it, and expands again', () => {
    wrap(<AppSidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app/home');
    expect(window.localStorage.getItem('chm-app-sidebar-collapsed')).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('starts collapsed on narrower screens when nothing is saved', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    wrap(<AppSidebar />);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});

describe('KOL directory and profile (app)', () => {
  it('shows the bio on each card, never the AI summary', () => {
    wrap(<KolNetwork />, '/app/kols');
    expect(screen.getByText(RUGO.bio)).toBeInTheDocument();
    expect(screen.queryByText('AI SUMMARY TEXT')).not.toBeInTheDocument();
    expect(screen.queryByText(/^AI$/)).not.toBeInTheDocument();
  });

  it('leads the profile with the bio and drops the intel blocks', () => {
    wrap(
      <Routes>
        <Route path="/app/kols/:kolId" element={<KolProfilePage />} />
      </Routes>,
      '/app/kols/hope-rugo',
    );
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText(RUGO.bio)).toBeInTheDocument();
    expect(screen.queryByText('Intel summary')).not.toBeInTheDocument();
    expect(screen.queryByText('AI SUMMARY TEXT')).not.toBeInTheDocument();
    expect(screen.queryByText('Research highlights')).not.toBeInTheDocument();
  });
});

describe('Podcasts', () => {
  const show = PODCAST_SHOWS.find((s) => s.id === 'breast-friends')!;

  it('gives a channel a copyable standalone link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    wrap(<PodcastChannel show={show} mode="app" />, '/app/podcast-network/breast-friends');
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/podcast-network/breast-friends`);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
  });

  it('lists episodes without the repeated show name, linking in-app', () => {
    wrap(<PodcastChannel show={show} mode="app" />, '/app/podcast-network/breast-friends');
    const list = screen.getByRole('heading', { name: 'Episodes' }).closest('section')!;
    const row = within(list).getByRole('link', { name: /Humanizing Cancer Care/ });
    expect(row).toHaveAttribute('href', expect.stringContaining('/app/podcast-network/breast-friends/watch/J88wBHM-AEY'));
    expect(within(list).queryByText(/The Breast Friends Podcast Ep\. 9 \|/)).not.toBeInTheDocument();
  });

  it('plays episodes inline on the public channel', () => {
    wrap(<PodcastChannel show={show} mode="public" />, '/podcast-network/breast-friends');
    expect(screen.getByText(/Now playing/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Humanizing Cancer Care/ })).toBeInTheDocument();
  });

  it('leads the hub with featured episodes, then every channel', async () => {
    wrap(<Podcasts />, '/app/podcast-network');
    const featured = screen.getByRole('heading', { name: 'Featured episodes' }).closest('section')!;
    const play = await within(featured).findAllByRole('link', { name: /Play episode/ });
    expect(play[0]).toHaveAttribute('href', '/app/podcast-network/breast-friends/watch/J88wBHM-AEY');
    const channels = screen.getByRole('heading', { name: 'Channels' }).closest('section')!;
    for (const s of PODCAST_SHOWS) {
      expect(within(channels).getByRole('link', { name: new RegExp(s.title) })).toHaveAttribute(
        'href',
        `/app/podcast-network/${s.id}`,
      );
    }
  });
});
