import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { CatalogService, YouTubeChannelVideoSort } from '../catalog/catalog.service';
import {
  getPodcastShowConfig,
  listPodcastShowConfigs,
} from './podcast-shows.config';

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

@Controller('podcasts')
export class PodcastsController {
  constructor(private readonly catalogService: CatalogService) {}

  /** GET /api/podcasts, public show list (no YouTube details). */
  @Get()
  listShows() {
    return listPodcastShowConfigs().map(({ id, title }) => ({ id, title }));
  }

  /**
   * GET /api/podcasts/:showId/episodes?sort=latest|popular|oldest
   * Episodes for an in-app podcast series (sourced from configured channel).
   */
  @Get(':showId/episodes')
  async getEpisodes(
    @Param('showId') showId: string,
    @Query('sort') sort?: string,
  ) {
    const show = getPodcastShowConfig(showId);
    if (!show) {
      throw new NotFoundException(`Podcast show not found: ${showId}`);
    }

    const allowed = new Set<YouTubeChannelVideoSort>([
      'latest',
      'popular',
      'oldest',
    ]);
    const sortKey: YouTubeChannelVideoSort = allowed.has(
      sort as YouTubeChannelVideoSort,
    )
      ? (sort as YouTubeChannelVideoSort)
      : 'latest';

    const channel = await this.catalogService.getYouTubeChannelVideos(
      show.youtubeChannelHandle,
      sortKey,
      show.minEpisodeDurationSeconds != null
        ? { minDurationSeconds: show.minEpisodeDurationSeconds }
        : undefined,
    );

    if (!channel) {
      return {
        show: { id: show.id, title: show.title },
        episodes: [] as PodcastEpisodeDto[],
      };
    }

    const byDateAsc = [...channel.videos].sort(
      (a, b) =>
        new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
    );
    const episodeNumbers = new Map<string, number>();
    byDateAsc.forEach((v, i) => episodeNumbers.set(v.id, i + 1));

    const episodes: PodcastEpisodeDto[] = channel.videos.map((v) => ({
      id: v.id,
      episodeNumber: episodeNumbers.get(v.id) ?? 0,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      playUrl: v.youtubeUrl,
      publishedAt: v.publishedAt,
      viewCount: v.viewCount,
      duration: v.duration,
    }));

    return {
      show: { id: show.id, title: channel.channelTitle || show.title },
      episodes,
    };
  }
}
