/** In-app podcast catalog (static until a feed/API exists). */

/** CHM umbrella show — shared “Listen on” destinations under each series. */
export const CHM_PODCAST_PLATFORM_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Apple Podcasts', href: 'https://podcasts.apple.com/us/podcast/community-health-media/id1837428248' },
  { label: 'Spotify', href: 'https://open.spotify.com/show/7e6ZVY93ogJny9AJJpANq4' },
  {
    label: 'Amazon Music',
    href:
      'https://music.amazon.com/podcasts/a6e36e68-9e9f-4f2b-88b7-e82a896de4a3/community-health-media-conversations',
  },
  { label: 'iHeartRadio', href: 'https://www.iheart.com/podcast/269-community-health-media-291542082' },
  { label: 'Castbox', href: 'https://castbox.fm/channel/id6735434?country=us' },
  {
    label: 'Pocket Casts',
    href: 'https://pocketcasts.com/podcast/community-health-media/4b3c4980-695c-013e-60d1-0affd6caf14d',
  },
  { label: 'Goodpods', href: 'https://goodpods.com/profile/chm-111066' },
] as const;

export type PodcastPlayLatest =
  | { kind: 'external'; href: string }
  | { kind: 'app'; to: string };

export type PodcastEpisode = {
  num: string;
  title: string;
  guests: string;
  date: string;
  dateIso: string;
  duration: string;
  description?: string;
};

export type PodcastShow = {
  id: string;
  title: string;
  tagline: string;
  image: string;
  /** Row like Apple’s category line */
  category: string;
  /** e.g. “Updated weekly”, “New season” */
  updateNote: string;
  episodes: PodcastEpisode[];
  /** Primary CTA for “Play latest” (defaults to CHM marketing site when omitted). */
  playLatest?: PodcastPlayLatest;
};

export const PODCAST_SHOWS: PodcastShow[] = [
  {
    id: 'breast-friends',
    title: 'Breast Friends',
    tagline:
      'Direct, expert-led conversations about breast cancer, built for patients and clinicians. We pair first-line data with what it feels like in the exam room and at home.',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    category: 'Clinical · Oncology',
    updateNote: 'Updated monthly',
    playLatest: { kind: 'external', href: 'https://linkin.bio/breastfriendspodcast/' },
    episodes: [
      {
        num: 'Ep 1',
        title: 'Welcome to Breast Friends: Why This Podcast Exists',
        guests: 'Community Health Media',
        date: 'Oct 22, 2025',
        dateIso: '2025-10-22',
        duration: '18 min',
        description:
          'The first episode lays out the goal: expert oncology talk that anyone in breast cancer can actually use, without the jargon wall.',
      },
      {
        num: 'Ep 2',
        title: 'Navigating Your First Diagnosis',
        guests: 'Community Health Media',
        date: 'Nov 4, 2025',
        dateIso: '2025-11-04',
        duration: '38 min',
        description:
          'Questions to bring to your team, how to read a pathology report, and what HER2+ means for your case.',
      },
      {
        num: 'Ep 3',
        title: 'Treatment Options Demystified',
        guests: 'Community Health Media',
        date: 'Nov 18, 2025',
        dateIso: '2025-11-18',
        duration: '42 min',
        description: 'Surgery, radiation, and systemic therapy in plain language, with no sales pitch.',
      },
    ],
  },
];

export const UPCOMING_PLACEHOLDER = {
  id: 'coming-soon-1',
  title: 'More series',
  tagline:
    'We are recording new disease-area shows and short-run seasons. When they ship, you will see them here first.',
  image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
} as const;
