import { useQuery } from '@tanstack/react-query';
import type { PodcastEpisode, PodcastShow } from '../../data/podcastsCatalog';
import { podcastsApi } from '../../api/podcasts';
import { mapPodcastEpisodesToUi } from '../../utils/podcastYouTube';

export function latestEpisode(show: PodcastShow, episodes?: PodcastEpisode[]): PodcastEpisode | null {
  const eps = episodes?.length ? episodes : show.episodes;
  if (!eps.length) return null;
  const sorted = [...eps].sort(
    (a, b) => new Date(b.dateIso).getTime() - new Date(a.dateIso).getTime(),
  );
  return sorted[0] ?? null;
}

/** Latest episode for cards: uses YouTube when configured. */
export function useShowLatestEpisode(show: PodcastShow): PodcastEpisode | null {
  const { data } = useQuery({
    queryKey: ['podcast', 'episodes', show.id, 'latest-card'],
    queryFn: async () => {
      if (!show.remoteEpisodes) return null;
      const result = await podcastsApi.getEpisodes(show.id, 'latest');
      if (!result.episodes.length) return null;
      return mapPodcastEpisodesToUi(result.episodes, result.show.title, {
        minDurationSeconds: show.minEpisodeDurationSeconds,
      })[0] ?? null;
    },
    enabled: !!show.remoteEpisodes,
    staleTime: 15 * 60 * 1000,
  });
  if (show.remoteEpisodes) return data ?? null;
  return latestEpisode(show);
}
