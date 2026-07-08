/**
 * Carousel master config.
 *
 * Every video carousel on CHT is declared here as a row with explicit
 * tag filters, sort order, dedup behavior, and caps. The runtime fetches
 * exactly what each carousel needs from the MediaHub public API,
 * eliminating the brittle hand-curated playlist→biomarker JSON file +
 * fuzzy-title-match approach that the 2026-05-16 audit found broken in
 * 12+ surfaces.
 *
 * Design doc: ops-console/.claude/audits/2026-05-17-cht-video-presentation-design.md
 * Audit: ops-console/.claude/audits/2026-05-16-cht-video-audit.md
 *
 * To add a new carousel: append a row. To change behavior: edit the row.
 * No code changes elsewhere unless adding genuinely new mechanics.
 *
 * The contract:
 * - `id`: stable identifier used as React key + analytics tag
 * - `label`: text rendered as the carousel heading
 * - `surface`: which page renders this row (informational; runtime
 *   doesn't enforce, but documents intent)
 * - `tag`: comma-separated namespaced MediaHub tag filter. AND across
 *   different namespaces, OR within the same namespace (matches the
 *   MediaHub /api/public/clips contract).
 * - `sort_by`: maps directly to MediaHub /clips ?sort_by= param.
 * - `dedup_by`: when 'shoot', collapses multi-platform versions of the
 *   same shoot. Otherwise undefined (no dedup).
 * - `per_shoot_cap`: after dedup, cap each shoot to N entries. 0/undefined
 *   = no cap.
 * - `limit`: page size. The carousel shows up to this many cards.
 * - `platform`: when set, filters to specific platforms. Default is
 *   'youtube' for all video carousels (kills LinkedIn duplicates from
 *   the audit). Set to undefined to include all platforms.
 *
 * NOTE on `sort_by=recorded_at`: as of 2026-05-17 the Shoot.shoot_date
 * field is backfilled from earliest YouTube post posted_at for the 27
 * existing shoots, but new content without shoot_id falls back to
 * posted_at. So 'recorded_at' is "best-effort recording date" not
 * "perfectly accurate." Use it for editorial/topical surfaces; use
 * 'recent' (= posted_at) + per_shoot_cap for "what's new" variety
 * surfaces where dedup matters more than recording-date accuracy.
 */

export type SortBy = 'recent' | 'posted' | 'recorded_at' | 'views' | 'likes';

export interface CarouselConfig {
  id: string;
  label: string;
  surface: string;
  tag?: string;
  sort_by: SortBy;
  dedup_by?: 'shoot';
  per_shoot_cap?: number;
  limit: number;
  /** Comma-separated platforms. Default 'youtube' enforced by the API client. */
  platform?: string;
}

/**
 * Carousels visible to anonymous (logged-out) users.
 * Public anonymous surfaces show fewer biomarker rows than the HCP dashboard
 * (matches the existing PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS=['her2','hr'] policy).
 */
export const ANON_CAROUSELS: CarouselConfig[] = [
  // /home — marketing landing
  {
    id: 'anon-home-featured',
    label: 'Featured videos',
    surface: '/home',
    sort_by: 'views', // highest-watched stand-ins for "curated" until we have an is_featured flag
    limit: 6,
  },
  {
    id: 'anon-home-her2',
    label: 'HER2+',
    surface: '/home',
    tag: 'biomarker:HER2+',
    sort_by: 'recorded_at',
    limit: 12,
  },
  {
    id: 'anon-home-hr',
    label: 'HR+',
    surface: '/home',
    tag: 'biomarker:HR+',
    sort_by: 'recorded_at',
    limit: 12,
  },

  // /catalog/breast-cancer — disease detail (only active disease area today)
  {
    id: 'anon-breast-conversations',
    label: 'Conversations',
    surface: '/catalog/breast-cancer',
    tag: 'biomarker:HER2+,biomarker:HER2-low,biomarker:HER2-ultralow,biomarker:HR+,biomarker:TNBC,biomarker:High-Risk / CNS',
    sort_by: 'recorded_at',
    limit: 24,
  },
];

/**
 * Carousels in the HCP dashboard (`/app/*` routes — authenticated).
 * Full biomarker breakdown matches the audit's existing labels.
 */
export const HCP_CAROUSELS: CarouselConfig[] = [
  // /app/home + /app/catalog (when not in clips-grid view) — dashboard

  {
    id: 'hcp-home-recently-added',
    label: 'Recently added',
    surface: '/app/home',
    // recent = posted_at; cap per shoot prevents 1 shoot filling the row;
    // dedup by shoot collapses the same content reposted to multiple platforms
    sort_by: 'recent',
    dedup_by: 'shoot',
    per_shoot_cap: 1,
    limit: 14,
  },

  // Biomarker rows. Use recorded_at so the topical lanes reflect when
  // content was made, not when it was reposted.
  {
    id: 'hcp-home-her2',
    label: 'HER2+ Conversations',
    surface: '/app/home',
    tag: 'biomarker:HER2+',
    sort_by: 'recorded_at',
    limit: 12,
  },
  {
    id: 'hcp-home-her2-low',
    label: 'HER2-Low / Ultra-Low',
    surface: '/app/home',
    tag: 'biomarker:HER2-low,biomarker:HER2-ultralow',
    sort_by: 'recorded_at',
    limit: 12,
  },
  {
    id: 'hcp-home-hr',
    label: 'HR+ · CDK4/6 · Endocrine',
    surface: '/app/home',
    tag: 'biomarker:HR+',
    sort_by: 'recorded_at',
    limit: 12,
  },
  {
    id: 'hcp-home-tnbc',
    label: 'TNBC & Triple Negative',
    surface: '/app/home',
    tag: 'biomarker:TNBC',
    sort_by: 'recorded_at',
    limit: 12,
  },
  {
    id: 'hcp-home-high-risk',
    label: 'High Risk Breast Cancer',
    // The MediaHub tag for high-risk content is 'biomarker:High-Risk / CNS'
    // (slash + space included in the canonical value). Distinct from TNBC.
    tag: 'biomarker:High-Risk / CNS',
    surface: '/app/home',
    sort_by: 'recorded_at',
    limit: 12,
  },
];

/**
 * Combined lookup by id. Use this for `useCarousel('id')` style fetching.
 */
export const ALL_CAROUSELS: Record<string, CarouselConfig> = Object.fromEntries(
  [...ANON_CAROUSELS, ...HCP_CAROUSELS].map((c) => [c.id, c]),
);

export function getCarousel(id: string): CarouselConfig | undefined {
  return ALL_CAROUSELS[id];
}
