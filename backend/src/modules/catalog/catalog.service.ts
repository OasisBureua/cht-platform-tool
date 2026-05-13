import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaHubService, type MediaHubClip } from './mediahub.service';
import { firstValueFrom } from 'rxjs';

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
  ) {}

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
        const items = await this.fetchFromYouTube(apiKey, playlistIds);
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
  ): Promise<CatalogItem[]> {
    const items: CatalogItem[] = [];

    for (const playlistId of playlistIds.slice(0, 20)) {
      try {
        const playlist = await this.getPlaylistDetails(apiKey, playlistId);
        const videoTitles = await this.getPlaylistVideoTitles(
          apiKey,
          playlistId,
        );

        const thumb =
          playlist.snippet?.thumbnails?.high ||
          playlist.snippet?.thumbnails?.medium ||
          playlist.snippet?.thumbnails?.default;

        /** YouTube’s total playlist size (prefer over truncated preview titles). */
        const itemTotal = playlist.contentDetails?.itemCount;
        items.push({
          id: playlist.id,
          title: playlist.snippet?.title || 'Untitled Playlist',
          thumbnailUrl: thumb?.url || '',
          videoNames: videoTitles,
          videoCount: itemTotal != null ? itemTotal : videoTitles.length,
          playUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
        });
      } catch (err) {
        this.logger.warn(`Failed to fetch playlist ${playlistId}: ${err}`);
      }
    }

    return items;
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

    // Shuffle and return the requested count
    return allVideos.sort(() => Math.random() - 0.5).slice(0, count);
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
      return await this.fetchFromYouTube(apiKey, playlistIds);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`YouTube playlists failed: ${msg}`);
      return [];
    }
  }

  /**
   * Get videos in a YouTube playlist (for Playlist detail page).
   */
  async getPlaylistVideos(
    playlistId: string,
  ): Promise<{ playlist: CatalogItem; videos: PlaylistVideo[] } | null> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    if (!apiKey) return null;
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
