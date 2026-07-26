/** Structured AI intel brief from Content Hub `PublicKOLAIBrief`. */
export interface PublicKolAiBrief {
  who_they_are?: string | null;
  what_they_focus_on?: string | null;
  chm_context?: string | null;
}

/** Optional HCP Intel overlay from Content Hub GET /kols*. */
export interface PublicKolIntel {
  npi?: string | null;
  specialty?: string | null;
  location?: string | null;
  email?: string | null;
  affiliation?: string | null;
  publications_approx?: number | null;
  open_payments?: { total: number; records: number; years: string } | null;
  ai_brief?: PublicKolAiBrief | null;
}

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

export type KolListQuery = {
  region?: string;
  institution?: string;
  q?: string;
  new_only?: boolean;
  limit?: number;
  offset?: number;
};

/** @deprecated Use PublicKol, kept for MediaHub EC2 fallback typing. */
export type MediaHubKol = PublicKol;
export type MediaHubKolList = PublicKolList;
export type MediaHubKolPublicationList = PublicKolPublicationList;
