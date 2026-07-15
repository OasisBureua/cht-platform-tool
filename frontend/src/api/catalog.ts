import apiClient from './client';

export interface CatalogItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  videoNames: string[];
  videoCount: number;
  playUrl?: string;
}

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
  shootId?: string;
  shoot_name?: string;
  wordpress?: PublicClipWordPress | null;
}

export interface WordPressCategoryItem {
  slug: string;
  post_count: number;
}

export interface WordPressCategoriesResponse {
  items: WordPressCategoryItem[];
  total: number;
}

/** Latest WordPress editorial state per post (ContentHub GET /wordpress). */
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

export type MediaHubTags = Record<string, string[]>;

export interface GetClipsParams {
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
}

export const catalogApi = {
  getItems: async (): Promise<CatalogItem[]> => {
    const { data } = await apiClient.get<CatalogItem[]>('/catalog');
    return data;
  },

  getTags: async (): Promise<MediaHubTags> => {
    const { data } = await apiClient.get<MediaHubTags>('/catalog/tags');
    return data || {};
  },

  getWordPressCategories: async (params?: {
    fresh?: boolean;
  }): Promise<WordPressCategoriesResponse> => {
    try {
      const { data } = await apiClient.get<WordPressCategoriesResponse>(
        '/catalog/wordpress/categories',
        { params: params?.fresh ? { fresh: '1' } : undefined },
      );
      return {
        items: data?.items ?? [],
        total: data?.total ?? data?.items?.length ?? 0,
      };
    } catch {
      return { items: [], total: 0 };
    }
  },

  getWordPressPosts: async (params?: {
    limit?: number;
    offset?: number;
    q?: string;
    category?: string;
    /** Bypass CHT Redis and hit ContentHub (admin refresh). */
    fresh?: boolean;
  }): Promise<WordPressPostsResponse> => {
    const { fresh, ...rest } = params ?? {};
    const { data } = await apiClient.get<WordPressPostsResponse>('/catalog/wordpress', {
      params: {
        ...rest,
        ...(fresh ? { fresh: '1' } : {}),
      },
    });
    return { items: data?.items ?? [], total: data?.total ?? 0 };
  },

  getClips: async (params?: GetClipsParams): Promise<{ items: MediaHubClip[]; total: number }> => {
    const query = params
      ? {
          ...params,
          has_wordpress:
            params.has_wordpress === true
              ? 'true'
              : params.has_wordpress === false
                ? 'false'
                : undefined,
        }
      : undefined;
    const { data } = await apiClient.get<{ items?: MediaHubClip[]; total?: number }>(
      '/catalog/clips',
      { params: query },
    );
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
