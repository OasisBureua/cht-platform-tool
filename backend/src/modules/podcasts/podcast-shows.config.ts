/**
 * Server-side podcast show registry. YouTube channel handles stay here —
 * clients call /api/podcasts/:showId/episodes only.
 */
export type PodcastShowConfig = {
  id: string;
  title: string;
  youtubeChannelHandle: string;
  /** Exclude promos/clips/Shorts — only list uploads at least this long (seconds). */
  minEpisodeDurationSeconds?: number;
};

export const PODCAST_SHOWS: Record<string, PodcastShowConfig> = {
  'breast-friends': {
    id: 'breast-friends',
    title: 'Breast Friends',
    youtubeChannelHandle: 'breastfriendspodcast',
    minEpisodeDurationSeconds: 15 * 60,
  },
};

export function getPodcastShowConfig(showId: string): PodcastShowConfig | null {
  return PODCAST_SHOWS[showId] ?? null;
}

export function listPodcastShowConfigs(): PodcastShowConfig[] {
  return Object.values(PODCAST_SHOWS);
}
