import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { cacheKeyHash } from '../../cache/cache-key.util';
import { MediaHubService, type MediaHubClip } from './mediahub.service';
import { firstValueFrom } from 'rxjs';
import {
  isLikelyYouTubeShort,
  isPodcastEpisodeVideo,
} from '../../utils/youtube-shorts.util';

export interface CatalogItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoNames: string[];
  videoCount: number;
  playUrl?: string;
}

interface YouTubePlaylistResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails?: { itemCount: number };
  }>;
}

interface YouTubePlaylistItemsResponse {
  nextPageToken?: string;
  items: Array<{
    snippet: {
      title: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
      resourceId?: { videoId?: string };
    };
  }>;
}

export interface PlaylistVideo {
  id: string;
  title: string;
  thumbnailUrl: string;
  youtubeUrl: string;
}

export type YouTubeChannelVideoSort = 'latest' | 'popular' | 'oldest';

export interface YouTubeChannelVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  youtubeUrl: string;
  publishedAt: string;
  viewCount: number;
  duration: string;
  channelTitle: string;
}

export interface YouTubeChannelVideosResult {
  handle: string;
  channelTitle: string;
  channelThumbnailUrl: string;
  videos: YouTubeChannelVideo[];
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);
  private readonly youtubeBase = 'https://www.googleapis.com/youtube/v3';

  onModuleInit() {
    if (this.mediahub.isConfigured()) {
      this.logger.log(
        'MediaHub catalog: configured (clips, tags, doctors, search)',
      );
    } else {
      const apiKey = this.config.get<string>('youtube.apiKey');
      const playlistIds =
        this.config.get<string[]>('youtube.playlistIds') || [];
      if (apiKey && playlistIds.length > 0) {
        this.logger.log(
          `YouTube catalog: configured with ${playlistIds.length} playlist(s)`,
        );
      } else {
        this.logger.log(
          `Catalog: MediaHub and YouTube not configured. Using DB programs.`,
        );
      }
    }
  }

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private prisma: PrismaService,
    private mediahub: MediaHubService,
    private cache: RedisCacheService,
  ) {}

  /** Catalog YouTube upstream cache — 30m (matches MediaHub / Redis defaults). */
  private readonly youtubeCacheTtlSeconds = 1_800;

  private async cachedYouTube<T>(
    key: string,
    loader: () => Promise<T>,
  ): Promise<T> {
    const hit = await this.cache.getJson<T>(key);
    if (hit != null) return hit;
    const value = await loader();
    await this.cache.setJson(key, value, this.youtubeCacheTtlSeconds);
    return value;
  }

  private async cachedYouTubeNullable<T>(
    key: string,
    loader: () => Promise<T | null>,
  ): Promise<T | null> {
    const hit = await this.cache.getJson<T>(key);
    if (hit != null) return hit;
    const value = await loader();
    if (value != null) {
      await this.cache.setJson(key, value, this.youtubeCacheTtlSeconds);
    }
    return value;
  }

  /**
   * Get catalog items from MediaHub (when configured), YouTube playlists, or DB programs.
   */
  async getCatalogItems(): Promise<CatalogItem[]> {
    if (this.mediahub.isConfigured()) {
      try {
        const { items } = await this.mediahub.getClips({ limit: 50 });
        const catalogItems = (items || []).map((c) =>
          this.mapMediaHubClipToCatalogItem(c),
        );
        this.logger.log(
          `MediaHub catalog: fetched ${catalogItems.length} clips`,
        );
        return catalogItems;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`MediaHub API failed: ${msg}. Falling back.`);
      }
    }

    const apiKey = this.config.get<string>('youtube.apiKey');
    const playlistIds = this.config.get<string[]>('youtube.playlistIds') || [];

    if (apiKey && playlistIds.length > 0) {
      try {
        const items = await this.cachedYouTube('cht:catalog:youtube:items', () =>
          this.fetchFromYouTube(apiKey, playlistIds),
        );
        this.logger.log(`YouTube catalog: fetched ${items.length} playlists`);
        return items;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `YouTube API failed: ${msg}. Falling back to programs.`,
        );
      }
    }

    return this.fetchFromPrograms();
  }

  private mapMediaHubClipToCatalogItem(clip: MediaHubClip): CatalogItem {
    const vidMatch = clip.youtube_url?.match(
      /(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/,
    );
    const thumb =
      clip.thumbnail_url ||
      (vidMatch
        ? `https://img.youtube.com/vi/${vidMatch[1]}/hqdefault.jpg`
        : '');
    return {
      id: clip.id,
      title: clip.title,
      thumbnailUrl: thumb,
      videoNames: clip.doctors?.length
        ? [clip.doctors.join(', ')]
        : [clip.title],
      videoCount: 1,
      playUrl: clip.youtube_url,
    };
  }

  private async fetchFromYouTube(
    apiKey: string,
    playlistIds: string[],
    options?: { previewTitles?: boolean },
  ): Promise<CatalogItem[]> {
    const previewTitles = options?.previewTitles !== false;
    const ids = playlistIds;

    const rows = await Promise.all(
      ids.map(async (playlistId) => {
        try {
          const playlist = await this.getPlaylistDetails(apiKey, playlistId);
          const videoTitles = previewTitles
            ? await this.getPlaylistVideoTitles(apiKey, playlistId)
            : [];

          const thumb =
            playlist.snippet?.thumbnails?.high ||
            playlist.snippet?.thumbnails?.medium ||
            playlist.snippet?.thumbnails?.default;

          /** YouTube’s total playlist size (prefer over truncated preview titles). */
          const itemTotal = playlist.contentDetails?.itemCount;
          return {
            id: playlist.id,
            title: playlist.snippet?.title || 'Untitled Playlist',
            thumbnailUrl: thumb?.url || '',
            videoNames: videoTitles,
            videoCount: itemTotal != null ? itemTotal : videoTitles.length,
            playUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          } as CatalogItem;
        } catch (err) {
          this.logger.warn(`Failed to fetch playlist ${playlistId}: ${err}`);
          return null;
        }
      }),
    );

    return rows.filter((row): row is CatalogItem => row != null);
  }

  private async getPlaylistDetails(apiKey: string, playlistId: string) {
    try {
      const { data } = await firstValueFrom(
        this.http.get<YouTubePlaylistResponse>(
          `${this.youtubeBase}/playlists`,
          {
            params: {
              part: 'snippet,contentDetails',
              id: playlistId,
              key: apiKey,
            },
          },
        ),
      );
      const item = data?.items?.[0];
      if (!item) throw new Error(`Playlist ${playlistId} not found`);
      return item;
    } catch (err: unknown) {
      const ax = err as {
        response?: {
          status?: number;
          data?: { error?: { message?: string; code?: number } };
        };
      };
      const msg =
        ax?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : String(err));
      const code = ax?.response?.data?.error?.code ?? ax?.response?.status;
      throw new Error(`YouTube playlists API: ${msg} (code=${code})`);
    }
  }

  /** First N video titles per playlist for catalog/home previews (full list uses getPlaylistVideosFull). */
  private static readonly PLAYLIST_PREVIEW_TITLE_MAX = 50;

  private async getPlaylistVideoTitles(
    apiKey: string,
    playlistId: string,
  ): Promise<string[]> {
    const titles: string[] = [];
    let pageToken: string | undefined;
    try {
      do {
        const { data } = await firstValueFrom(
          this.http.get<YouTubePlaylistItemsResponse>(
            `${this.youtubeBase}/playlistItems`,
            {
              params: {
                part: 'snippet',
                playlistId,
                maxResults: 50,
                pageToken,
                key: apiKey,
              },
            },
          ),
        );
        for (const i of data?.items || []) {
          const t = i.snippet?.title || '';
          if (t) titles.push(t);
          if (titles.length >= CatalogService.PLAYLIST_PREVIEW_TITLE_MAX) break;
        }
        pageToken =
          titles.length >= CatalogService.PLAYLIST_PREVIEW_TITLE_MAX
            ? undefined
            : data?.nextPageToken;
      } while (
        pageToken &&
        titles.length < CatalogService.PLAYLIST_PREVIEW_TITLE_MAX
      );
      return titles;
    } catch (err: unknown) {
      const ax = err as {
        response?: { status?: number; data?: { error?: { message?: string } } };
      };
      const msg =
        ax?.response?.data?.error?.message ??
        (err instanceof Error ? err.message : String(err));
      throw new Error(`YouTube playlistItems API: ${msg}`);
    }
  }

  /**
   * Get random videos from YouTube playlists (for Home page carousel).
   * Picks random playlists, fetches their first page of videos, returns a shuffled sample.
   */
  async getRandomVideos(count = 6): Promise<PlaylistVideo[]> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    const playlistIds = this.config.get<string[]>('youtube.playlistIds') || [];
    if (!apiKey || playlistIds.length === 0) return [];

    return this.cachedYouTube(`cht:catalog:youtube:random:${count}`, async () => {
      // Shuffle playlist IDs and try up to 5 random ones
      const shuffled = [...playlistIds]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);
      const allVideos: PlaylistVideo[] = [];

      for (const playlistId of shuffled) {
        if (allVideos.length >= count * 3) break;
        try {
          const { data } = await firstValueFrom(
            this.http.get<YouTubePlaylistItemsResponse>(
              `${this.youtubeBase}/playlistItems`,
              {
                params: {
                  part: 'snippet',
                  playlistId,
                  maxResults: 20,
                  key: apiKey,
                },
              },
            ),
          );
          for (const item of data?.items || []) {
            const videoId = item.snippet?.resourceId?.videoId;
            if (!videoId) continue;
            const thumb =
              item.snippet?.thumbnails?.high ||
              item.snippet?.thumbnails?.medium ||
              item.snippet?.thumbnails?.default;
            allVideos.push({
              id: videoId,
              title: item.snippet?.title || 'Video',
              thumbnailUrl:
                thumb?.url ||
                `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
            });
          }
        } catch (err) {
          this.logger.warn(
            `Random videos: failed to fetch playlist ${playlistId}: ${err}`,
          );
        }
      }

      return allVideos.sort(() => Math.random() - 0.5).slice(0, count);
    });
  }

  /**
   * Get YouTube playlists (for Catalog page). Returns empty when YouTube not configured.
   */
  async getPlaylists(): Promise<CatalogItem[]> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    const playlistIds = this.config.get<string[]>('youtube.playlistIds') || [];
    if (!apiKey || playlistIds.length === 0) {
      return [];
    }

    try {
      return await this.cachedYouTube('cht:catalog:youtube:playlists:list', () =>
        this.fetchFromYouTube(apiKey, playlistIds, { previewTitles: false }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`YouTube playlists failed: ${msg}`);
      return [];
    }
  }

  /**
   * Channel uploads (UU… playlist) include Shorts and promos; mimic youtube.com/@handle/videos
   * by dropping Shorts (≤3 min / #Shorts) and optionally enforcing a minimum episode length.
   */
  async getYouTubeChannelVideos(
    rawHandle: string,
    sort: YouTubeChannelVideoSort = 'latest',
    options?: { minDurationSeconds?: number },
  ): Promise<YouTubeChannelVideosResult | null> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    if (!apiKey) return null;

    const handle = rawHandle.replace(/^@+/, '').trim();
    if (!handle) return null;

    const cacheKey = `cht:catalog:youtube:channel:${handle}:${sort}:${options?.minDurationSeconds ?? 'default'}`;

    return this.cachedYouTubeNullable(cacheKey, async () => {
      try {
        const channel = await this.getChannelByHandle(apiKey, handle);
      const uploadsPlaylistId =
        channel.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        throw new Error(`Channel @${handle} has no uploads playlist`);
      }

      const playlistItems = await this.getPlaylistItemsWithPublishedAt(
        apiKey,
        uploadsPlaylistId,
      );
      if (playlistItems.length === 0) {
        const thumb =
          channel.snippet?.thumbnails?.high ||
          channel.snippet?.thumbnails?.medium ||
          channel.snippet?.thumbnails?.default;
        return {
          handle,
          channelTitle: channel.snippet?.title || handle,
          channelThumbnailUrl: thumb?.url || '',
          videos: [],
        };
      }

      const videoIds = playlistItems.map((i) => i.videoId);
      const details = await this.getVideoDetails(apiKey, videoIds);
      const detailById = new Map(details.map((d) => [d.id, d]));

      const videos: YouTubeChannelVideo[] = [];
      let skipped = 0;
      for (const item of playlistItems) {
        const detail = detailById.get(item.videoId);
        if (!detail) continue;
        const snippet = detail.snippet;
        const duration = detail.contentDetails?.duration || '';
        const candidate = {
          title: snippet?.title || item.title || '',
          description: snippet?.description || '',
          tags: snippet?.tags,
          duration,
        };
        const minDurationSeconds = options?.minDurationSeconds;
        const include =
          minDurationSeconds != null
            ? isPodcastEpisodeVideo({ ...candidate, minDurationSeconds })
            : !isLikelyYouTubeShort(candidate);
        if (!include) {
          skipped += 1;
          continue;
        }
        const thumb =
          detail.snippet?.thumbnails?.high ||
          detail.snippet?.thumbnails?.medium ||
          detail.snippet?.thumbnails?.default;
        videos.push({
          id: detail.id,
          title: detail.snippet?.title || item.title || 'Video',
          description: detail.snippet?.description || '',
          thumbnailUrl:
            thumb?.url ||
            `https://img.youtube.com/vi/${detail.id}/hqdefault.jpg`,
          youtubeUrl: `https://www.youtube.com/watch?v=${detail.id}`,
          publishedAt: detail.snippet?.publishedAt || item.publishedAt,
          viewCount: parseInt(detail.statistics?.viewCount || '0', 10) || 0,
          duration: detail.contentDetails?.duration || '',
          channelTitle: detail.snippet?.channelTitle || channel.snippet?.title || '',
        });
      }

      if (skipped > 0) {
        this.logger.log(
          `YouTube @${handle}: excluded ${skipped} Short/promo upload(s); returning ${videos.length} video(s)`,
        );
      }

      this.sortYouTubeChannelVideos(videos, sort);

      const channelThumb =
        channel.snippet?.thumbnails?.high ||
        channel.snippet?.thumbnails?.medium ||
        channel.snippet?.thumbnails?.default;

      return {
        handle,
        channelTitle: channel.snippet?.title || handle,
        channelThumbnailUrl: channelThumb?.url || '',
        videos,
      };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`YouTube channel @${handle} failed: ${msg}`);
        return null;
      }
    });
  }

  private sortYouTubeChannelVideos(
    videos: YouTubeChannelVideo[],
    sort: YouTubeChannelVideoSort,
  ) {
    videos.sort((a, b) => {
      if (sort === 'popular') {
        return b.viewCount - a.viewCount;
      }
      const aTime = new Date(a.publishedAt).getTime();
      const bTime = new Date(b.publishedAt).getTime();
      return sort === 'oldest' ? aTime - bTime : bTime - aTime;
    });
  }

  private async getChannelByHandle(
    apiKey: string,
    handle: string,
  ): Promise<{
    snippet?: {
      title?: string;
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }> {
    const { data } = await firstValueFrom(
      this.http.get<{
        items?: Array<{
          snippet?: {
            title?: string;
            thumbnails?: {
              high?: { url: string };
              medium?: { url: string };
              default?: { url: string };
            };
          };
          contentDetails?: { relatedPlaylists?: { uploads?: string } };
        }>;
      }>(`${this.youtubeBase}/channels`, {
        params: {
          part: 'snippet,contentDetails',
          forHandle: handle,
          key: apiKey,
        },
      }),
    );
    const item = data?.items?.[0];
    if (!item) throw new Error(`YouTube channel @${handle} not found`);
    return item;
  }

  private async getPlaylistItemsWithPublishedAt(
    apiKey: string,
    playlistId: string,
  ): Promise<Array<{ videoId: string; title: string; publishedAt: string }>> {
    const items: Array<{ videoId: string; title: string; publishedAt: string }> =
      [];
    let pageToken: string | undefined;
    do {
      const { data } = await firstValueFrom(
        this.http.get<
          YouTubePlaylistItemsResponse & { nextPageToken?: string }
        >(`${this.youtubeBase}/playlistItems`, {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: 50,
            pageToken: pageToken || undefined,
            key: apiKey,
          },
        }),
      );
      for (const item of data?.items || []) {
        const videoId = item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        items.push({
          videoId,
          title: item.snippet?.title || '',
          publishedAt: item.snippet?.publishedAt || '',
        });
      }
      pageToken = data?.nextPageToken;
    } while (pageToken);
    return items;
  }

  private async getVideoDetails(
    apiKey: string,
    videoIds: string[],
  ): Promise<
    Array<{
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        channelTitle?: string;
        tags?: string[];
        thumbnails?: {
          high?: { url: string };
          medium?: { url: string };
          default?: { url: string };
        };
      };
      statistics?: { viewCount?: string };
      contentDetails?: { duration?: string };
    }>
  > {
    const results: Array<{
      id: string;
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        channelTitle?: string;
        tags?: string[];
        thumbnails?: {
          high?: { url: string };
          medium?: { url: string };
          default?: { url: string };
        };
      };
      statistics?: { viewCount?: string };
      contentDetails?: { duration?: string };
    }> = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      const chunk = videoIds.slice(i, i + 50);
      const { data } = await firstValueFrom(
        this.http.get<{
          items?: Array<{
            id: string;
            snippet?: {
              title?: string;
              description?: string;
              publishedAt?: string;
              channelTitle?: string;
              thumbnails?: {
                high?: { url: string };
                medium?: { url: string };
                default?: { url: string };
              };
            };
            statistics?: { viewCount?: string };
            contentDetails?: { duration?: string };
          }>;
        }>(`${this.youtubeBase}/videos`, {
          params: {
            part: 'snippet,statistics,contentDetails',
            id: chunk.join(','),
            key: apiKey,
          },
        }),
      );
      results.push(...(data?.items || []));
    }
    return results;
  }

  /**
   * Get videos in a YouTube playlist (for Playlist detail page).
   */
  async getPlaylistVideos(
    playlistId: string,
  ): Promise<{ playlist: CatalogItem; videos: PlaylistVideo[] } | null> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    if (!apiKey) return null;

    const cacheKey = `cht:catalog:youtube:playlist:${playlistId}`;

    return this.cachedYouTubeNullable(cacheKey, async () => {
      try {
        const playlist = await this.getPlaylistDetails(apiKey, playlistId);
        const videos = await this.getPlaylistVideosFull(apiKey, playlistId);
        const thumb =
          playlist.snippet?.thumbnails?.high ||
          playlist.snippet?.thumbnails?.medium ||
          playlist.snippet?.thumbnails?.default;
        return {
          playlist: {
            id: playlist.id,
            title: playlist.snippet?.title || 'Untitled Playlist',
            thumbnailUrl: thumb?.url || '',
            videoNames: videos.map((v) => v.title),
            videoCount: videos.length,
            playUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
          },
          videos,
        };
      } catch (err) {
        this.logger.warn(`Failed to fetch playlist ${playlistId}: ${err}`);
        return null;
      }
    });
  }

  private async getPlaylistVideosFull(
    apiKey: string,
    playlistId: string,
  ): Promise<PlaylistVideo[]> {
    const videos: PlaylistVideo[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await firstValueFrom(
        this.http.get<
          YouTubePlaylistItemsResponse & { nextPageToken?: string }
        >(`${this.youtubeBase}/playlistItems`, {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: 50,
            pageToken: pageToken || undefined,
            key: apiKey,
          },
        }),
      );
      for (const item of data?.items || []) {
        const sn = item.snippet;
        const videoId = sn?.resourceId?.videoId;
        if (!videoId) continue;
        const thumb =
          sn?.thumbnails?.high ||
          sn?.thumbnails?.medium ||
          sn?.thumbnails?.default;
        videos.push({
          id: videoId,
          title: sn?.title || 'Video',
          thumbnailUrl:
            thumb?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        });
      }
      pageToken = data?.nextPageToken;
    } while (pageToken);
    return videos;
  }

  /**
   * Fallback: use programs from DB. Derive YouTube thumbnails from video IDs.
   */
  private async fetchFromPrograms(): Promise<CatalogItem[]> {
    const programs = await this.prisma.program.findMany({
      where: { status: 'PUBLISHED' },
      include: {
        videos: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return programs.map((p) => {
      const firstYoutube = p.videos.find((v) => v.platform === 'YOUTUBE');
      const thumbnailUrl =
        p.thumbnailUrl ||
        (firstYoutube
          ? `https://img.youtube.com/vi/${firstYoutube.videoId}/hqdefault.jpg`
          : '');

      return {
        id: p.id,
        title: p.title,
        thumbnailUrl:
          thumbnailUrl ||
          'https://via.placeholder.com/400x260?text=No+thumbnail',
        videoNames: p.videos.map((v) => v.title),
        videoCount: p.videos.length,
        playUrl: `/app/webinars/${p.id}`,
      };
    });
  }
}
