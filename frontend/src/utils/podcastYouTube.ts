import type { PodcastEpisode } from '../data/podcastsCatalog';
import { formatYouTubeDuration } from './youtubeDuration';
import type { PodcastEpisodeDto } from '../api/podcasts';
import { isPodcastEpisodeVideo } from './youtubeShorts';

export type PodcastEpisodeSort = 'latest' | 'popular' | 'oldest';

export function mapPodcastEpisodesToUi(
  episodes: PodcastEpisodeDto[],
  showTitle: string,
  options?: { minDurationSeconds?: number },
): PodcastEpisode[] {
  return episodes
    .filter((v) =>
      isPodcastEpisodeVideo({
        title: v.title,
        description: v.description,
        duration: v.duration,
        minDurationSeconds: options?.minDurationSeconds,
      }),
    )
    .map((v) => {
    const published = new Date(v.publishedAt);
    return {
      num: v.episodeNumber > 0 ? `Ep ${v.episodeNumber}` : 'Ep',
      title: v.title,
      guests: showTitle,
      date: published.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      dateIso: v.publishedAt.slice(0, 10),
      duration: formatYouTubeDuration(v.duration),
      description: stripDescription(v.description),
      videoId: v.id,
      youtubeUrl: v.playUrl,
      thumbnailUrl: v.thumbnailUrl,
      viewCount: v.viewCount,
    };
  });
}

function stripDescription(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const firstBlock = trimmed.split('\n\n')[0]?.trim() ?? trimmed;
  return firstBlock.length > 280 ? `${firstBlock.slice(0, 277)}…` : firstBlock;
}

/** @deprecated use mapPodcastEpisodesToUi, kept for any stale imports */
export type YouTubeChannelVideoDto = PodcastEpisodeDto;
export const mapYouTubeVideosToEpisodes = mapPodcastEpisodesToUi;
