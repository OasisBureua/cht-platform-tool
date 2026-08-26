import apiClient from './client';
import type { PodcastEpisodeSort } from '../utils/podcastYouTube';

export type PodcastEpisodeDto = {
  id: string;
  episodeNumber: number;
  title: string;
  description: string;
  thumbnailUrl: string;
  playUrl: string;
  publishedAt: string;
  viewCount: number;
  duration: string;
};

export type PodcastEpisodesResponse = {
  show: { id: string; title: string };
  episodes: PodcastEpisodeDto[];
};

export const podcastsApi = {
  listShows: async (): Promise<{ id: string; title: string }[]> => {
    const { data } = await apiClient.get<{ id: string; title: string }[]>('/podcasts');
    return Array.isArray(data) ? data : [];
  },

  getEpisodes: async (
    showId: string,
    sort: PodcastEpisodeSort = 'latest',
  ): Promise<PodcastEpisodesResponse> => {
    const { data } = await apiClient.get<PodcastEpisodesResponse>(
      `/podcasts/${encodeURIComponent(showId)}/episodes`,
      { params: { sort } },
    );
    return data ?? { show: { id: showId, title: showId }, episodes: [] };
  },
};
