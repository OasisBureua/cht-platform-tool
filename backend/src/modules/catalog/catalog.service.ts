import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
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
  items: Array<{
    snippet: {
      title: string;
    };
  }>;
}

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);
  private readonly youtubeBase = 'https://www.googleapis.com/youtube/v3';

  onModuleInit() {
    const apiKey = this.config.get<string>('youtube.apiKey');
    const playlistIds = this.config.get<string[]>('youtube.playlistIds') || [];
    if (apiKey && playlistIds.length > 0) {
      this.logger.log(`YouTube catalog: configured with ${playlistIds.length} playlist(s)`);
    } else {
      this.logger.log(
        `YouTube catalog: not configured (apiKey=${!!apiKey}, playlists=${playlistIds.length}). Using DB programs.`,
      );
    }
  }

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get catalog items from YouTube playlists (when configured) or from programs in DB.
   */
  async getCatalogItems(): Promise<CatalogItem[]> {
    const apiKey = this.config.get<string>('youtube.apiKey');
    const playlistIds = this.config.get<string[]>('youtube.playlistIds') || [];

    if (!apiKey || playlistIds.length === 0) {
      this.logger.debug(
        `YouTube not configured: apiKey=${!!apiKey}, playlistCount=${playlistIds.length}. Using programs fallback.`,
      );
      return this.fetchFromPrograms();
    }

    try {
      const items = await this.fetchFromYouTube(apiKey, playlistIds);
      this.logger.log(`YouTube catalog: fetched ${items.length} playlists`);
      return items;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      this.logger.warn(
        `YouTube API failed (status=${status ?? 'N/A'}): ${msg}. Falling back to programs.`,
      );
      return this.fetchFromPrograms();
    }
  }

  private async fetchFromYouTube(apiKey: string, playlistIds: string[]): Promise<CatalogItem[]> {
    const items: CatalogItem[] = [];

    for (const playlistId of playlistIds.slice(0, 20)) {
      try {
        const playlist = await this.getPlaylistDetails(apiKey, playlistId);
        const videoTitles = await this.getPlaylistVideoTitles(apiKey, playlistId);

        const thumb = playlist.snippet?.thumbnails?.high
          || playlist.snippet?.thumbnails?.medium
          || playlist.snippet?.thumbnails?.default;

        items.push({
          id: playlist.id,
          title: playlist.snippet?.title || 'Untitled Playlist',
          thumbnailUrl: thumb?.url || '',
          videoNames: videoTitles,
          videoCount: videoTitles.length || playlist.contentDetails?.itemCount || 0,
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
        this.http.get<YouTubePlaylistResponse>(`${this.youtubeBase}/playlists`, {
          params: {
            part: 'snippet,contentDetails',
            id: playlistId,
            key: apiKey,
          },
        }),
      );
      const item = data?.items?.[0];
      if (!item) throw new Error(`Playlist ${playlistId} not found`);
      return item;
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: { message?: string; code?: number } } } };
      const msg = ax?.response?.data?.error?.message ?? (err instanceof Error ? err.message : String(err));
      const code = ax?.response?.data?.error?.code ?? ax?.response?.status;
      throw new Error(`YouTube playlists API: ${msg} (code=${code})`);
    }
  }

  private async getPlaylistVideoTitles(apiKey: string, playlistId: string): Promise<string[]> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<YouTubePlaylistItemsResponse>(`${this.youtubeBase}/playlistItems`, {
          params: {
            part: 'snippet',
            playlistId,
            maxResults: 10,
            key: apiKey,
          },
        }),
      );
      return (data?.items || []).map((i) => i.snippet?.title || 'Video').filter(Boolean);
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { error?: { message?: string } } } };
      const msg = ax?.response?.data?.error?.message ?? (err instanceof Error ? err.message : String(err));
      throw new Error(`YouTube playlistItems API: ${msg}`);
    }
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
        p.thumbnailUrl
        || (firstYoutube
          ? `https://img.youtube.com/vi/${firstYoutube.videoId}/hqdefault.jpg`
          : '');

      return {
        id: p.id,
        title: p.title,
        thumbnailUrl: thumbnailUrl || 'https://via.placeholder.com/400x260?text=No+thumbnail',
        videoNames: p.videos.map((v) => v.title),
        videoCount: p.videos.length,
        playUrl: `/app/webinars/${p.id}`,
      };
    });
  }
}
