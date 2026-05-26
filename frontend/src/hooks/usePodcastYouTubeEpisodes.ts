import { useQuery } from '@tanstack/react-query';
import { podcastsApi } from '../api/podcasts';
import type { PodcastEpisode } from '../data/podcastsCatalog';
import { mapPodcastEpisodesToUi, type PodcastEpisodeSort } from '../utils/podcastYouTube';

export function usePodcastEpisodes(showId: string | undefined, sort: PodcastEpisodeSort) {
  return useQuery({
    queryKey: ['podcast', 'episodes', showId, sort],
    queryFn: async (): Promise<{ showTitle: string; episodes: PodcastEpisode[] }> => {
      const data = await podcastsApi.getEpisodes(showId!, sort);
      return {
        showTitle: data.show.title,
        episodes: mapPodcastEpisodesToUi(data.episodes, data.show.title),
      };
    },
    enabled: !!showId,
    staleTime: 15 * 60 * 1000,
  });
}

/** @deprecated use usePodcastEpisodes */
export const usePodcastYouTubeEpisodes = usePodcastEpisodes;
