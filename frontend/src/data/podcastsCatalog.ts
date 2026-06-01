/** In-app podcast catalog — static show metadata; episodes may load from YouTube. */

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

export const BREAST_FRIENDS_PLATFORM_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Breast Friends', href: 'https://linkin.bio/breastfriendspodcast/' },
  ...CHM_PODCAST_PLATFORM_LINKS,
] as const;

export const CANCER_UNFILTERED_PLATFORM_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Cancer Unfiltered', href: 'https://linkin.bio/cancerunfiltered/' },
  ...CHM_PODCAST_PLATFORM_LINKS,
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
  /** YouTube video id when synced from a channel */
  videoId?: string;
  youtubeUrl?: string;
  thumbnailUrl?: string;
  viewCount?: number;
};

export type PodcastShow = {
  id: string;
  title: string;
  tagline: string;
  /** Cover / episode artwork (square); used in carousels and cards */
  image: string;
  /** Optional horizontal lockup for series headers (object-contain); falls back to `image` */
  logo?: string;
  /** Row like Apple’s category line */
  category: string;
  /** e.g. “Updated weekly”, “New season” */
  updateNote: string;
  /** Static fallback episodes when the episodes API is unavailable */
  episodes: PodcastEpisode[];
  /** When true, episodes load from GET /api/podcasts/:id/episodes */
  remoteEpisodes?: boolean;
  /** Client-side filter for promos/Shorts when API returns unfiltered uploads. */
  minEpisodeDurationSeconds?: number;
  /** Override default CHM “Listen on” links */
  platformLinks?: ReadonlyArray<{ label: string; href: string }>;
  /** Primary CTA for “Play latest” (defaults to CHM marketing site when omitted). */
  playLatest?: PodcastPlayLatest;
};

export const PODCAST_SHOWS: PodcastShow[] = [
  {
    id: 'breast-friends',
    title: 'Breast Friends',
    tagline:
      'Direct, expert-led conversations about breast cancer, built for patients and clinicians. We pair first-line data with what it feels like in the exam room and at home.',
    image: '/images/podcasts/breast-friends/cover.png',
    logo: '/images/podcasts/breast-friends/logo-with-names-full-color.png',
    category: 'Clinical · Oncology',
    updateNote: 'New episodes monthly',
    remoteEpisodes: true,
    minEpisodeDurationSeconds: 15 * 60,
    platformLinks: BREAST_FRIENDS_PLATFORM_LINKS,
    episodes: [],
  },
  {
    id: 'cancer-unfiltered',
    title: 'Cancer Unfiltered',
    tagline:
      'Candid conversations with leading oncologists on the realities of cancer care—honest perspectives, real-world insights, and what it means for patients and clinicians.',
    image: '/images/podcasts/cancer-unfiltered/cover.png',
    logo: '/images/podcasts/cancer-unfiltered/logo.png',
    category: 'Clinical · Oncology',
    updateNote: 'New episodes monthly',
    remoteEpisodes: true,
    minEpisodeDurationSeconds: 15 * 60,
    platformLinks: CANCER_UNFILTERED_PLATFORM_LINKS,
    episodes: [],
  },
];

export const UPCOMING_PLACEHOLDER = {
  id: 'coming-soon-1',
  title: 'More series',
  tagline:
    'We are recording new disease-area shows and short-run seasons. When they ship, you will see them here first.',
  image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
} as const;
