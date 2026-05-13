import apiClient from './client';

export interface CatalogItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoNames: string[];
  videoCount: number;
  playUrl?: string;
}

/**
 * MediaHub clip from GET /api/catalog/clips and GET /api/catalog/clips/:id
 * (proxied from MediaHub /api/public/clips list + detail; includes description + ai_summary).
 */
export interface MediaHubClip {
  id: string;
  title: string;
  description: string;
  ai_summary?: string;
  /** Same as ai_summary when API returns camelCase */
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
  shootId?: string;
  shoot_name?: string;
}

/** Tags grouped by category (doctor, biomarker, drug, trial, stage, topic, brand) */
export type MediaHubTags = Record<string, string[]>;

export const catalogApi = {
  getItems: async (): Promise<CatalogItem[]> => {
    const { data } = await apiClient.get<CatalogItem[]>('/catalog');
    return data;
  },

  getTags: async (): Promise<MediaHubTags> => {
    const { data } = await apiClient.get<MediaHubTags>('/catalog/tags');
    return data || {};
  },

  getClips: async (params?: {
    q?: string;
    tag?: string;
    doctor?: string;
    platform?: string;
    sort_by?: 'views' | 'likes' | 'recent' | 'posted';
    limit?: number;
    offset?: number;
  }): Promise<{ items: MediaHubClip[]; total: number }> => {
    const { data } = await apiClient.get<{ items?: MediaHubClip[]; total?: number }>('/catalog/clips', { params });
    return { items: data?.items || [], total: data?.total ?? 0 };
  },

  getClip: async (id: string): Promise<MediaHubClip | null> => {
    const { data } = await apiClient.get<MediaHubClip | null>(
      `/catalog/clips/${encodeURIComponent(id)}`,
    );
    return data;
  },

  getDoctors: async (): Promise<{ slug: string; shoot_count?: number; post_count?: number; total_views?: number; total_likes?: number }[]> => {
    const { data } = await apiClient.get('/catalog/doctors');
    return Array.isArray(data) ? data : [];
  },

  getDoctor: async (slug: string): Promise<{ clips?: MediaHubClip[] } | null> => {
    const { data } = await apiClient.get(`/catalog/doctors/${slug}`);
    return data;
  },

  search: async (q: string, params?: { limit?: number; offset?: number }): Promise<{ items: MediaHubClip[]; total: number }> => {
    const { data } = await apiClient.get<{ items?: MediaHubClip[]; total?: number }>('/catalog/search', {
      params: { q, ...params },
    });
    return { items: data?.items || [], total: data?.total ?? 0 };
  },

  getTranscript: async (shootId: string): Promise<unknown> => {
    const { data } = await apiClient.get(`/catalog/transcripts/${shootId}`);
    return data;
  },

  getRandomVideos: async (count = 6): Promise<{ id: string; title: string; thumbnailUrl: string; youtubeUrl: string }[]> => {
    const { data } = await apiClient.get<unknown>('/catalog/random-videos', { params: { count } });
    if (Array.isArray(data)) return data as { id: string; title: string; thumbnailUrl: string; youtubeUrl: string }[];
    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: { id: string; title: string; thumbnailUrl: string; youtubeUrl: string }[] }).items;
    }
    return [];
  },

  getPlaylists: async (): Promise<CatalogItem[]> => {
    const { data } = await apiClient.get<unknown>('/catalog/playlists');
    if (Array.isArray(data)) return data as CatalogItem[];
    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: CatalogItem[] }).items;
    }
    return [];
  },

  getPlaylist: async (playlistId: string): Promise<{
    playlist: CatalogItem;
    videos: { id: string; title: string; thumbnailUrl: string; youtubeUrl: string }[];
  } | null> => {
    const { data } = await apiClient.get(`/catalog/playlists/${playlistId}`);
    return data;
  },
};
