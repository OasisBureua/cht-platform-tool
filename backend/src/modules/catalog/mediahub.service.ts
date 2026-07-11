import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';
import { RedisCacheService } from '../../cache/redis-cache.service';
import type {
  MediaHubKol,
  MediaHubKolList,
  MediaHubKolPublicationList,
} from '../kol-network/kol-network.types';

export type {
  MediaHubKol,
  MediaHubKolList,
  MediaHubKolPublicationList,
} from '../kol-network/kol-network.types';

const MEDIAHUB_BASE_URL = 'https://mediahub.communityhealth.media/api/public';

export interface MediaHubTag {
  [category: string]: string[];
}

/** WordPress editorial metadata joined by ContentHub on /api/public/clips. */
export interface PublicClipWordPress {
  post_id: number;
  permalink: string;
  slug: string;
  categories: string[];
  tags: string[];
  series: string[];
  featured_media_url: string | null;
  modified_gmt: string;
}

/** Mirrors public clips list/detail from MediaHub or ContentHub. */
export interface MediaHubClip {
  id: string;
  title: string;
  description: string;
  ai_summary?: string;
  aiSummary?: string;
  tags: string[];
  doctors: string[];
  thumbnail_url: string;
  youtube_url: string;
  duration_seconds: number;
  is_short: boolean;
  posted_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  shoot_id?: string;
  shoot_name?: string;
  wordpress?: PublicClipWordPress | null;
}

export interface MediaHubClipsResponse {
  items?: MediaHubClip[];
  total?: number;
}

export interface WordPressCategoryItem {
  slug: string;
  post_count: number;
}

export interface WordPressCategoriesResponse {
  items: WordPressCategoryItem[];
  total: number;
}

export interface MediaHubDoctor {
  slug: string;
  shoot_count?: number;
  post_count?: number;
  total_views?: number;
  total_likes?: number;
}

@Injectable()
export class MediaHubService {
  private readonly logger = new Logger(MediaHubService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | null;
  private readonly useContentHub: boolean;
  private readonly wordpressOnlyDefault: boolean;
  private readonly clipsCacheTtlSeconds: number;

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private cache: RedisCacheService,
  ) {
    this.useContentHub = !!this.config.get<boolean>('catalog.useContentHub');
    this.wordpressOnlyDefault = !!this.config.get<boolean>('catalog.wordpressOnly');
    this.clipsCacheTtlSeconds =
      this.config.get<number>('catalog.clipsCacheTtlSeconds') ?? 14400;

    if (this.useContentHub) {
      this.baseUrl =
        this.config.get<string>('contenthub.baseUrl')?.replace(/\/$/, '') ||
        '';
      this.apiKey = this.config.get<string>('contenthub.apiKey') || null;
      this.logger.log(
        `Catalog upstream: ContentHub (${this.baseUrl || 'missing URL'})`,
      );
    } else {
      this.baseUrl =
        this.config.get<string>('mediahub.baseUrl') || MEDIAHUB_BASE_URL;
      this.apiKey = this.config.get<string>('mediahub.apiKey') || null;
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  usesContentHubCatalog(): boolean {
    return this.useContentHub;
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('Catalog upstream API key not configured');
    }
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  private cacheKey(prefix: string, params?: Record<string, unknown>): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(params ?? {}))
      .digest('hex')
      .slice(0, 16);
    return `cht:catalog:${this.useContentHub ? 'contenthub' : 'mediahub'}:${prefix}:${hash}`;
  }

  private async cachedGet<T>(
    key: string,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.cache.getJson<T>(key);
    if (cached != null) return cached;
    const value = await fetcher();
    await this.cache.setJson(key, value, this.clipsCacheTtlSeconds);
    return value;
  }

  private async get<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const cleanParams = params
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ) as Record<string, string | number>)
      : undefined;

    const { data } = await firstValueFrom(
      this.http.get<T>(url, {
        headers: this.getHeaders(),
        params: cleanParams,
      }),
    );
    return data;
  }

  async getTags(): Promise<MediaHubTag> {
    return this.get<MediaHubTag>('/tags');
  }

  async getClips(params?: {
    q?: string;
    tag?: string;
    doctor?: string;
    platform?: string;
    sort_by?: 'views' | 'likes' | 'recent' | 'posted' | 'recorded_at';
    dedup_by?: 'shoot';
    per_shoot_cap?: number;
    limit?: number;
    offset?: number;
    has_wordpress?: boolean;
    wp_category?: string;
  }): Promise<MediaHubClipsResponse> {
    const searchParams: Record<string, string | number> = {};
    if (params?.q) searchParams.q = params.q;
    if (params?.tag) searchParams.tag = params.tag;
    if (params?.doctor) searchParams.doctor = params.doctor;

    const platform =
      params?.platform === undefined ? 'youtube' : params.platform;
    if (platform) searchParams.platform = platform;

    if (params?.sort_by) searchParams.sort_by = params.sort_by;
    if (params?.dedup_by) searchParams.dedup_by = params.dedup_by;
    if (params?.per_shoot_cap != null)
      searchParams.per_shoot_cap = params.per_shoot_cap;
    if (params?.limit != null) searchParams.limit = params.limit;
    if (params?.offset != null) searchParams.offset = params.offset;

    const hasWordpress =
      params?.has_wordpress ??
      (this.useContentHub && this.wordpressOnlyDefault);
    if (hasWordpress) searchParams.has_wordpress = 'true';
    if (params?.wp_category) searchParams.wp_category = params.wp_category;

    const cacheParams = { ...searchParams, path: '/clips' };
    const key = this.cacheKey('clips', cacheParams);

    return this.cachedGet(key, async () => {
      const result = await this.get<MediaHubClipsResponse | MediaHubClip[]>(
        '/clips',
        Object.keys(searchParams).length > 0 ? searchParams : undefined,
      );

      if (Array.isArray(result)) {
        return { items: result, total: result.length };
      }
      return result;
    });
  }

  async getWordPressCategories(): Promise<WordPressCategoriesResponse> {
    if (!this.useContentHub) {
      return { items: [], total: 0 };
    }
    const key = this.cacheKey('wordpress-categories', {});
    return this.cachedGet(key, () =>
      this.get<WordPressCategoriesResponse>('/wordpress/categories'),
    );
  }

  async getPlaylistTags(params?: {
    tag?: string;
    lane?: 'biomarker' | 'drug' | 'trial' | 'doctor_pair' | 'mixed' | 'archive';
    limit?: number;
    offset?: number;
  }): Promise<MediaHubPlaylistTagList> {
    const searchParams: Record<string, string | number> = {};
    if (params?.tag) searchParams.tag = params.tag;
    if (params?.lane) searchParams.lane = params.lane;
    if (params?.limit != null) searchParams.limit = params.limit;
    if (params?.offset != null) searchParams.offset = params.offset;

    return this.get<MediaHubPlaylistTagList>(
      '/playlists',
      Object.keys(searchParams).length > 0 ? searchParams : undefined,
    );
  }

  async getClip(id: string): Promise<MediaHubClip> {
    const key = this.cacheKey('clip', { id });
    return this.cachedGet(key, () =>
      this.get<MediaHubClip>(`/clips/${encodeURIComponent(id)}`),
    );
  }

  async getDoctors(): Promise<MediaHubDoctor[]> {
    const result = await this.get<
      MediaHubDoctor[] | { items?: MediaHubDoctor[] }
    >('/doctors');
    if (Array.isArray(result)) return result;
    return (result as { items?: MediaHubDoctor[] }).items || [];
  }

  async getDoctor(
    slug: string,
  ): Promise<MediaHubDoctor & { clips?: MediaHubClip[] }> {
    return this.get(`/doctors/${slug}`);
  }

  async getShoots(): Promise<unknown[]> {
    const result = await this.get<unknown[]>('/shoots');
    return Array.isArray(result) ? result : [];
  }

  async getTranscript(shootId: string): Promise<unknown> {
    return this.get(`/transcripts/${shootId}`);
  }

  async search(
    q: string,
    params?: { limit?: number; offset?: number },
  ): Promise<MediaHubClipsResponse> {
    return this.getClips({ q, ...params });
  }

  async getKols(params?: {
    region?: string;
    institution?: string;
    q?: string;
    new_only?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MediaHubKolList> {
    const cleanParams: Record<string, string | number | undefined> = {};
    if (params?.region) cleanParams.region = params.region;
    if (params?.institution) cleanParams.institution = params.institution;
    if (params?.q) cleanParams.q = params.q;
    if (params?.new_only) cleanParams.new_only = 'true';
    if (params?.limit != null) cleanParams.limit = params.limit;
    if (params?.offset != null) cleanParams.offset = params.offset;
    return this.get<MediaHubKolList>('/kols', cleanParams);
  }

  async getKol(slug: string): Promise<MediaHubKol> {
    return this.get<MediaHubKol>(`/kols/${encodeURIComponent(slug)}`);
  }

  async getKolPublications(
    slug: string,
    params?: { limit?: number; offset?: number },
  ): Promise<MediaHubKolPublicationList> {
    const cleanParams: Record<string, string | number | undefined> = {};
    if (params?.limit != null) cleanParams.limit = params.limit;
    if (params?.offset != null) cleanParams.offset = params.offset;
    return this.get<MediaHubKolPublicationList>(
      `/kols/${encodeURIComponent(slug)}/publications`,
      cleanParams,
    );
  }
}

export interface MediaHubPlaylistTag {
  youtube_playlist_id: string;
  tags: string[];
  lane: string | null;
}

export interface MediaHubPlaylistTagList {
  items: MediaHubPlaylistTag[];
  total: number;
}
