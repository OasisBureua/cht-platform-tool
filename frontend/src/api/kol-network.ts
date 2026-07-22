import apiClient from './client';

/** Structured AI intel brief from Content Hub `PublicKOLAIBrief`. */
export interface PublicKolAiBrief {
  who_they_are?: string | null;
  what_they_focus_on?: string | null;
  chm_context?: string | null;
}

/** HCP Intel overlay from Content Hub when kols.hcp_npi is linked. Email is omitted on the public KOL UI. */
export interface PublicKolIntel {
  npi?: string | null;
  specialty?: string | null;
  location?: string | null;
  affiliation?: string | null;
  publications_approx?: number | null;
  open_payments?: { total: number; records: number; years: string } | null;
  ai_brief?: PublicKolAiBrief | null;
}

/**
 * Public KOL — proxied from Content Hub via CHT GET /api/kol-network/*.
 * Source of truth for roster; static dol-network.ts fills education/social only.
 */
export interface PublicKol {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  specialty: string | null;
  institution: string | null;
  bio: string | null;
  photo_url: string | null;
  region: string | null;
  /** SCRUM-70: curator ordering fields — optional for backwards compat. */
  featured?: boolean;
  display_order?: number | null;
  region_label: string | null;
  shoot_count: number;
  first_appeared_at: string | null;
  is_new: boolean;
  intel?: PublicKolIntel | null;
}

export interface PublicKolRegionFacet {
  slug: string;
  label: string;
  kol_count: number;
}

export interface PublicKolList {
  items: PublicKol[];
  total: number;
  regions: PublicKolRegionFacet[];
  institutions: string[];
}

export type KolListParams = {
  region?: string;
  institution?: string;
  q?: string;
  new_only?: boolean;
  limit?: number;
  offset?: number;
  /** `public` = marketing /kol-network; `app` = member CHM Docs directory */
  surface?: 'public' | 'app';
};

export interface PublicKolPublication {
  title: string;
  url: string | null;
  journal: string | null;
  published_at: string;
  is_first_author: boolean;
  is_last_author: boolean;
}

export interface PublicKolPublicationList {
  items: PublicKolPublication[];
  total: number;
}

export const kolNetworkApi = {
  list: async (params?: KolListParams): Promise<PublicKolList> => {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.region) queryParams.region = params.region;
    if (params?.institution) queryParams.institution = params.institution;
    if (params?.q) queryParams.q = params.q;
    if (params?.new_only) queryParams.new_only = 'true';
    if (params?.limit != null) queryParams.limit = params.limit;
    if (params?.offset != null) queryParams.offset = params.offset;
    if (params?.surface) queryParams.surface = params.surface;
    const { data } = await apiClient.get<PublicKolList>('/kol-network', {
      params: queryParams,
    });
    return (
      data ?? { items: [], total: 0, regions: [], institutions: [] }
    );
  },

  get: async (slug: string, surface?: 'public' | 'app'): Promise<PublicKol | null> => {
    try {
      const { data } = await apiClient.get<PublicKol>(
        `/kol-network/${encodeURIComponent(slug)}`,
        { params: surface ? { surface } : undefined },
      );
      return data ?? null;
    } catch (err: unknown) {
      const status =
        (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status === 404) return null;
      throw err;
    }
  },

  publications: async (
    slug: string,
    params?: { limit?: number; offset?: number },
  ): Promise<PublicKolPublicationList> => {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.limit != null) queryParams.limit = params.limit;
    if (params?.offset != null) queryParams.offset = params.offset;
    const { data } = await apiClient.get<PublicKolPublicationList>(
      `/kol-network/${encodeURIComponent(slug)}/publications`,
      { params: queryParams },
    );
    return data ?? { items: [], total: 0 };
  },
};
