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

export interface WordPressPostItem {
  post_id: number;
  slug: string;
  title: string;
  permalink: string;
  categories: string[];
  tags: string[];
  series?: string[];
  youtube_video_id: string | null;
  featured_media_url: string | null;
  modified_gmt: string;
}

export interface WordPressPostsResponse {
  items: WordPressPostItem[];
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
  /** ContentHub (devhub) when WP catalog enabled; otherwise MediaHub. */
  private readonly publicBaseUrl: string;
  private readonly publicApiKey: string | null;
  private readonly useContentHub: boolean;
  private readonly wordpressOnlyDefault: boolean;
  private readonly clipsCacheTtlSeconds: number;
  private readonly wordpressCacheTtlSeconds: number;

  constructor(
    private config: ConfigService,
    private http: HttpService,
    private cache: RedisCacheService,
  ) {
    this.useContentHub = !!this.config.get<boolean>('catalog.useContentHub');
    this.wordpressOnlyDefault = !!this.config.get<boolean>('catalog.wordpressOnly');
    this.clipsCacheTtlSeconds =
      this.config.get<number>('catalog.clipsCacheTtlSeconds') ?? 1800;
    this.wordpressCacheTtlSeconds =
      this.config.get<number>('catalog.wordpressCacheTtlSeconds') ?? 300;

    if (this.useContentHub) {
      this.publicBaseUrl =
        this.config.get<string>('contenthub.baseUrl')?.replace(/\/$/, '') ||
        '';
      this.publicApiKey = this.config.get<string>('contenthub.apiKey') || null;
      this.logger.log(
        `Catalog upstream: ContentHub (${this.publicBaseUrl || 'missing URL'})`,
      );
    } else {
      this.publicBaseUrl =
        this.config.get<string>('mediahub.baseUrl') || MEDIAHUB_BASE_URL;
      this.publicApiKey = this.config.get<string>('mediahub.apiKey') || null;
    }
  }

  isConfigured(): boolean {
    return !!this.publicApiKey && !!this.publicBaseUrl;
  }

  isClipsConfigured(): boolean {
    return this.isConfigured();
  }

  usesContentHubCatalog(): boolean {
    return this.useContentHub;
  }

  private getHeaders(apiKey: string | null): Record<string, string> {
    if (!apiKey) {
      throw new Error('Catalog upstream API key not configured');
    }
    return {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };
  }

  private cacheKey(
    prefix: string,
    params?: Record<string, unknown>,
  ): string {
    const upstream = this.useContentHub ? 'contenthub' : 'mediahub';
    const hash = createHash('sha256')
      .update(JSON.stringify(params ?? {}))
      .digest('hex')
      .slice(0, 16);
    return `cht:catalog:${upstream}:${prefix}:${hash}`;
  }

  private async cachedGet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.cache.getJson<T>(key);
    if (cached != null) return cached;
    const value = await fetcher();
    await this.cache.setJson(
      key,
      value,
      ttlSeconds ?? this.clipsCacheTtlSeconds,
    );
    return value;
  }

  private isDevEnvironment(): boolean {
    const env = this.config.get<string>('app.environment') ?? '';
    return env === 'dev' || env === 'development';
  }

  private normalizeClipsResponse(
    result: MediaHubClipsResponse | MediaHubClip[],
  ): MediaHubClipsResponse {
    if (Array.isArray(result)) {
      return { items: result, total: result.length };
    }
    return {
      items: result?.items ?? [],
      total: result?.total ?? result?.items?.length ?? 0,
    };
  }

  /** Devhub can expose WP categories before the clip↔WP join returns has_wordpress rows. */
  private async fetchClipsFromUpstream(
    searchParams: Record<string, string | number>,
  ): Promise<MediaHubClipsResponse> {
    let result = this.normalizeClipsResponse(
      await this.getPublic<MediaHubClipsResponse | MediaHubClip[]>(
        '/clips',
        Object.keys(searchParams).length > 0 ? searchParams : undefined,
      ),
    );

    if (
      this.useContentHub &&
      searchParams.has_wordpress === 'true' &&
      (result.items?.length ?? 0) === 0 &&
      this.isDevEnvironment()
    ) {
      this.logger.warn(
        'ContentHub returned 0 clips with has_wordpress=true; retrying without WP filter (dev only until clip join ships)',
      );
      const relaxed = { ...searchParams };
      delete relaxed.has_wordpress;
      result = this.normalizeClipsResponse(
        await this.getPublic<MediaHubClipsResponse | MediaHubClip[]>(
          '/clips',
          Object.keys(relaxed).length > 0 ? relaxed : undefined,
        ),
      );
    }

    return result;
  }

  private async getFrom<T>(
    baseUrl: string,
    apiKey: string | null,
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const url = `${baseUrl}${path}`;
    const cleanParams = params
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== ''),
        ) as Record<string, string | number>)
      : undefined;

    const { data } = await firstValueFrom(
      this.http.get<T>(url, {
        headers: this.getHeaders(apiKey),
        params: cleanParams,
      }),
    );
    return data;
  }

  private async getPublic<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    return this.getFrom(this.publicBaseUrl, this.publicApiKey, path, params);
  }

  /**
   * MediaHub exposes namespaced `/tags`. ContentHub does not — map WordPress
   * categories into the `topic` namespace so legacy catalog filters still work.
   */
  async getTags(): Promise<MediaHubTag> {
    if (this.useContentHub) {
      return this.cachedGet(this.cacheKey('tags', { source: 'wordpress' }), async () => {
        const cats = await this.getWordPressCategories();
        const topics = (cats.items ?? [])
          .map((c) => c.slug?.trim())
          .filter((s): s is string => !!s);
        if (!topics.length) return {} as MediaHubTag;
        return { topic: topics } satisfies MediaHubTag;
      });
    }
    return this.cachedGet(this.cacheKey('tags', {}), () =>
      this.getPublic<MediaHubTag>('/tags'),
    );
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

    const cached = await this.cache.getJson<MediaHubClipsResponse>(key);
    const cachedEmptyWpFilter =
      this.useContentHub &&
      searchParams.has_wordpress === 'true' &&
      (cached?.items?.length ?? 0) === 0 &&
      this.isDevEnvironment();
    if (cached != null && !cachedEmptyWpFilter) {
      return cached;
    }

    const value = await this.fetchClipsFromUpstream(searchParams);
    if ((value.items?.length ?? 0) > 0 || searchParams.has_wordpress !== 'true') {
      await this.cache.setJson(key, value, this.clipsCacheTtlSeconds);
    }
    if (value.items?.length) {
      await this.seedClipCache(value.items);
    }
    return value;
  }

  /** Index list results so /clips/:id works when ContentHub detail is missing. */
  private async seedClipCache(clips: MediaHubClip[]): Promise<void> {
    await Promise.all(
      clips.flatMap((clip) => {
        const ids = this.clipIdVariants(clip.id);
        return ids.map((id) =>
          this.cache.setJson(
            this.cacheKey('clip', { id }),
            clip,
            this.clipsCacheTtlSeconds,
          ),
        );
      }),
    );
  }

  private clipIdVariants(id: string): string[] {
    const ids = new Set<string>([id]);
    const shortMatch = id.match(/:([a-zA-Z0-9_-]{11})$/);
    if (shortMatch) {
      ids.add(shortMatch[1]);
    } else if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
      ids.add(`official:youtube:${id}`);
    }
    return [...ids];
  }

  private clipIdsMatch(clipId: string, requested: string): boolean {
    const left = this.clipIdVariants(clipId);
    const right = new Set(this.clipIdVariants(requested));
    return left.some((id) => right.has(id));
  }

  /** ContentHub /clips/:id may 404 while list works — scan list as a bridge. */
  private async findClipInList(id: string): Promise<MediaHubClip | null> {
    const pageSize = 50;
    const maxPages = 20;
    for (let page = 0; page < maxPages; page++) {
      const result = await this.getClips({
        limit: pageSize,
        offset: page * pageSize,
        has_wordpress: false,
        sort_by: 'recorded_at',
      });
      const items = result.items ?? [];
      const match = items.find((c) => this.clipIdsMatch(c.id, id));
      if (match) return match;
      if (items.length < pageSize) break;
      const total = result.total ?? 0;
      if (total > pageSize && page * pageSize + items.length >= total) break;
    }
    return null;
  }

  async getWordPressCategories(): Promise<WordPressCategoriesResponse> {
    if (!this.useContentHub) {
      return { items: [], total: 0 };
    }
    try {
      const key = this.cacheKey('wordpress-categories', {});
      return await this.cachedGet(
        key,
        () =>
          this.getPublic<WordPressCategoriesResponse>('/wordpress/categories'),
        this.wordpressCacheTtlSeconds,
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 401) {
        this.logger.warn(
          `ContentHub /wordpress/categories unavailable (${status ?? 'error'}) — returning empty`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /**
   * Latest WordPress editorial posts (ContentHub GET /wordpress).
   * Used by admin Content tab — view-only mirror of WP, not authoring.
   */
  async getWordPressPosts(params?: {
    limit?: number;
    offset?: number;
    q?: string;
    category?: string;
  }): Promise<WordPressPostsResponse> {
    if (!this.useContentHub) {
      return { items: [], total: 0 };
    }
    const searchParams: Record<string, string | number> = {};
    if (params?.limit != null) searchParams.limit = params.limit;
    if (params?.offset != null) searchParams.offset = params.offset;
    if (params?.q) searchParams.q = params.q;
    if (params?.category) searchParams.category = params.category;

    const key = this.cacheKey('wordpress-posts', { ...searchParams, hideProbe: true });
    try {
      return await this.cachedGet(
        key,
        async () => {
          const result = await this.getPublic<
            WordPressPostsResponse | WordPressPostItem[]
          >(
            '/wordpress',
            Object.keys(searchParams).length > 0 ? searchParams : undefined,
          );
          const raw = Array.isArray(result)
            ? { items: result, total: result.length }
            : {
                items: result?.items ?? [],
                total: result?.total ?? result?.items?.length ?? 0,
              };
          const items = raw.items.filter((p) => !this.isProbeWordPressPost(p));
          const removed = raw.items.length - items.length;
          return {
            items,
            total: Math.max(0, (raw.total ?? 0) - removed),
          };
        },
        this.wordpressCacheTtlSeconds,
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 401) {
        this.logger.warn(
          `ContentHub /wordpress unavailable (${status ?? 'error'}) — returning empty`,
        );
        return { items: [], total: 0 };
      }
      throw err;
    }
  }

  /** Hide ContentHub seed/test posts (probe, smoke, logging tests). */
  private isProbeWordPressPost(post: WordPressPostItem): boolean {
    const slug = (post.slug || '').toLowerCase();
    const title = (post.title || '').toLowerCase();
    return (
      slug.includes('probe') ||
      title.includes('probe') ||
      slug.includes('smoke') ||
      title.includes('smoke')
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

    return this.cachedGet(
      this.cacheKey('playlists', searchParams),
      () =>
        this.getPublic<MediaHubPlaylistTagList>(
          '/playlists',
          Object.keys(searchParams).length > 0 ? searchParams : undefined,
        ),
    );
  }

  async getClip(id: string): Promise<MediaHubClip> {
    for (const candidate of this.clipIdVariants(id)) {
      const cached = await this.cache.getJson<MediaHubClip>(
        this.cacheKey('clip', { id: candidate }),
      );
      if (cached) return cached;
    }

    for (const candidate of this.clipIdVariants(id)) {
      try {
        const clip = await this.getPublic<MediaHubClip>(
          `/clips/${encodeURIComponent(candidate)}`,
        );
        await this.seedClipCache([clip]);
        return clip;
      } catch {
        // try next variant / list fallback
      }
    }

    const found = await this.findClipInList(id);
    if (found) {
      this.logger.warn(
        `ContentHub /clips/:id miss for ${id}; resolved via clips list`,
      );
      await this.seedClipCache([found]);
      return found;
    }

    throw new Error(`Clip not found: ${id}`);
  }

  /**
   * MediaHub `/doctors`. ContentHub has no such route — use KOL directory
   * slugs (same identifiers the catalog doctor filter expects).
   */
  async getDoctors(): Promise<MediaHubDoctor[]> {
    if (this.useContentHub) {
      return this.cachedGet(
        this.cacheKey('doctors', { source: 'kols' }),
        () => this.doctorsFromContentHubKols(),
      );
    }
    return this.cachedGet(this.cacheKey('doctors', {}), async () => {
      const result = await this.getPublic<
        MediaHubDoctor[] | { items?: MediaHubDoctor[] }
      >('/doctors');
      if (Array.isArray(result)) return result;
      return (result as { items?: MediaHubDoctor[] }).items || [];
    });
  }

  private async doctorsFromContentHubKols(): Promise<MediaHubDoctor[]> {
    const pageSize = 100;
    const doctors: MediaHubDoctor[] = [];
    const seen = new Set<string>();
    let offset = 0;
    for (let page = 0; page < 50; page++) {
      const result = await this.getKols({ limit: pageSize, offset });
      const items = result.items ?? [];
      for (const kol of items) {
        const slug = kol.slug?.trim();
        if (!slug || seen.has(slug)) continue;
        seen.add(slug);
        doctors.push({
          slug,
          shoot_count: kol.shoot_count,
        });
      }
      if (items.length < pageSize) break;
      offset += pageSize;
      const total = result.total ?? 0;
      if (total > 0 && offset >= total) break;
    }
    return doctors;
  }

  async getDoctor(
    slug: string,
  ): Promise<MediaHubDoctor & { clips?: MediaHubClip[] }> {
    if (this.useContentHub) {
      return this.cachedGet(this.cacheKey('doctor', { slug, source: 'kol' }), async () => {
        const kol = await this.getKol(slug);
        const clips = await this.getClips({
          doctor: slug,
          limit: 50,
          has_wordpress: false,
        });
        return {
          slug: kol.slug,
          shoot_count: kol.shoot_count,
          clips: clips.items ?? [],
        };
      });
    }
    return this.cachedGet(this.cacheKey('doctor', { slug }), () =>
      this.getPublic(`/doctors/${slug}`),
    );
  }

  async getShoots(): Promise<unknown[]> {
    return this.cachedGet(this.cacheKey('shoots', {}), async () => {
      const result = await this.getPublic<unknown[]>('/shoots');
      return Array.isArray(result) ? result : [];
    });
  }

  async getTranscript(shootId: string): Promise<unknown> {
    return this.cachedGet(this.cacheKey('transcript', { shootId }), () =>
      this.getPublic(`/transcripts/${shootId}`),
    );
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
    return this.cachedGet(this.cacheKey('kols', cleanParams), () =>
      this.getPublic<MediaHubKolList>('/kols', cleanParams),
    );
  }

  async getKol(slug: string): Promise<MediaHubKol> {
    return this.cachedGet(this.cacheKey('kol', { slug }), () =>
      this.getPublic<MediaHubKol>(`/kols/${encodeURIComponent(slug)}`),
    );
  }

  async getKolPublications(
    slug: string,
    params?: { limit?: number; offset?: number },
  ): Promise<MediaHubKolPublicationList> {
    const cleanParams: Record<string, string | number | undefined> = {};
    if (params?.limit != null) cleanParams.limit = params.limit;
    if (params?.offset != null) cleanParams.offset = params.offset;
    return this.cachedGet(
      this.cacheKey('kol-publications', { slug, ...cleanParams }),
      () =>
        this.getPublic<MediaHubKolPublicationList>(
          `/kols/${encodeURIComponent(slug)}/publications`,
          cleanParams,
        ),
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
