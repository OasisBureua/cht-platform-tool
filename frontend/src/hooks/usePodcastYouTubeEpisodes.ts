import { useQuery } from '@tanstack/react-query';
import { podcastsApi } from '../api/podcasts';
import { PODCAST_SHOWS, type PodcastEpisode } from '../data/podcastsCatalog';
import { mapPodcastEpisodesToUi, type PodcastEpisodeSort } from '../utils/podcastYouTube';

/** Shared so a page reading several shows at once hits the same cache as each channel. */
export function podcastEpisodesQuery(showId: string | undefined, sort: PodcastEpisodeSort) {
  return {
    queryKey: ['podcast', 'episodes', showId, sort],
    queryFn: async (): Promise<{ showTitle: string; episodes: PodcastEpisode[] }> => {
      const data = await podcastsApi.getEpisodes(showId!, sort);
      return {
        showTitle: data.show.title,
        episodes: mapPodcastEpisodesToUi(data.episodes, data.show.title, {
          minDurationSeconds: showId
            ? PODCAST_SHOWS.find((s) => s.id === showId)?.minEpisodeDurationSeconds
            : undefined,
        }),
      };
    },
    enabled: !!showId,
    staleTime: 15 * 60 * 1000,
  };
}

export function usePodcastEpisodes(showId: string | undefined, sort: PodcastEpisodeSort) {
  return useQuery(podcastEpisodesQuery(showId, sort));
}

/** @deprecated use usePodcastEpisodes */
export const usePodcastYouTubeEpisodes = usePodcastEpisodes;
