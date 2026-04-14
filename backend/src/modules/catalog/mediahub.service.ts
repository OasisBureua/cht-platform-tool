import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const MEDIAHUB_BASE_URL = 'https://mediahub.communityhealth.media/api/public';

export interface MediaHubTag {
  [category: string]: string[];
}

/** Mirrors MediaHub public clips list/detail: description + optional ai_summary (snake_case). */
export interface MediaHubClip {
  id: string;
  title: string;
  description: string;
  ai_summary?: string;
  /** Some gateways may emit camelCase; prefer ai_summary from /api/public/clips. */
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
}

export interface MediaHubClipsResponse {
  items?: MediaHubClip[];
  total?: number;
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

  constructor(
    private config: ConfigService,
    private http: HttpService,
  ) {
    this.baseUrl = this.config.get<string>('mediahub.baseUrl') || MEDIAHUB_BASE_URL;
    this.apiKey = this.config.get<string>('mediahub.apiKey') || null;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private getHeaders(): Record<string, string> {
    if (!this.apiKey) {
      throw new Error('MediaHub API key not configured');
    }
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey,
    };
  }

  private async get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
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

  /**
   * GET /tags - All tags grouped by category
   */
  async getTags(): Promise<MediaHubTag> {
    return this.get<MediaHubTag>('/tags');
  }

  /**
   * GET /clips - Video catalog with filters
   */
  async getClips(params?: {
    q?: string;
    tag?: string;
    doctor?: string;
    platform?: string;
    sort_by?: 'views' | 'likes' | 'recent' | 'posted';
    limit?: number;
    offset?: number;
  }): Promise<MediaHubClipsResponse> {
    const searchParams: Record<string, string | number> = {};
    if (params?.q) searchParams.q = params.q;
    if (params?.tag) searchParams.tag = params.tag;
    if (params?.doctor) searchParams.doctor = params.doctor;
    if (params?.platform) searchParams.platform = params.platform;
    if (params?.sort_by) searchParams.sort_by = params.sort_by;
    if (params?.limit != null) searchParams.limit = params.limit;
    if (params?.offset != null) searchParams.offset = params.offset;

    const result = await this.get<MediaHubClipsResponse | MediaHubClip[]>(
      '/clips',
      Object.keys(searchParams).length > 0 ? searchParams : undefined,
    );

    if (Array.isArray(result)) {
      return { items: result, total: result.length };
    }
    return result as MediaHubClipsResponse;
  }

  /**
   * GET /clips/{id} - Single clip detail
   */
  async getClip(id: string): Promise<MediaHubClip> {
    return this.get<MediaHubClip>(`/clips/${id}`);
  }

  /**
   * GET /doctors - Doctor profiles
   */
  async getDoctors(): Promise<MediaHubDoctor[]> {
    const result = await this.get<MediaHubDoctor[] | { items?: MediaHubDoctor[] }>('/doctors');
    if (Array.isArray(result)) return result;
    return (result as { items?: MediaHubDoctor[] }).items || [];
  }

  /**
   * GET /doctors/{slug} - Doctor detail with clips
   */
  async getDoctor(slug: string): Promise<MediaHubDoctor & { clips?: MediaHubClip[] }> {
    return this.get(`/doctors/${slug}`);
  }

  /**
   * GET /shoots - Shoots with doctors, stats
   */
  async getShoots(): Promise<unknown[]> {
    const result = await this.get<unknown[]>('/shoots');
    return Array.isArray(result) ? result : [];
  }

  /**
   * GET /transcripts/{shoot_id} - Full diarized transcript
   */
  async getTranscript(shootId: string): Promise<unknown> {
    return this.get(`/transcripts/${shootId}`);
  }

  /**
   * GET /search?q= - Full-text search (alias for clips with query)
   */
  async search(q: string, params?: { limit?: number; offset?: number }): Promise<MediaHubClipsResponse> {
    return this.getClips({ q, ...params });
  }
}
