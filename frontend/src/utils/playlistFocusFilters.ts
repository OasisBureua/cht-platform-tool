/** URL `?playlistFocus=` — cohort strips + catalogue browse (`hr` matches home + HR strip.) */
export type PlaylistFocus = 'her2' | 'hr' | 'her2-low' | 'tnbc' | 'high-risk';

const VALID_FOCUS = new Set<string>(['her2', 'hr', 'her2-low', 'tnbc', 'high-risk']);

/** Curated section labels in `_generated-catalog-playlists.json` → `playlistFocus` param. */
export const CATALOG_SECTION_TO_FOCUS: Record<string, PlaylistFocus> = {
  'HER2+ Conversations': 'her2',
  'HER2-Low / Ultra-Low': 'her2-low',
  'HR+ · CDK4/6 · Endocrine': 'hr',
  'TNBC & Triple Negative': 'tnbc',
  'High Risk Breast Cancer': 'high-risk',
};

/**
 * ContentHub / MediaHub clip tags for each cohort chip.
 * Playlist focus browse loads clips by these tags (not by fuzzy YouTube playlist title match).
 */
export const PLAYLIST_FOCUS_TO_TAG: Record<PlaylistFocus, string> = {
  her2: 'biomarker:HER2+',
  'her2-low': 'biomarker:HER2-low,biomarker:HER2-ultralow',
  hr: 'biomarker:HR+',
  tnbc: 'biomarker:TNBC',
  'high-risk': 'biomarker:High-Risk / CNS',
};

export function buildCatalogSectionPlaylistsHref(isInApp: boolean, sectionLabel: string): string {
  const focus = CATALOG_SECTION_TO_FOCUS[sectionLabel];
  const base = isInApp ? '/app/catalog' : '/catalog';
  if (!focus) return `${base}?view=playlists`;
  return `${base}?view=playlists&playlistFocus=${encodeURIComponent(focus)}`;
}

/** Row CTA; opens in-app / public playlist focus (`?playlistFocus=`). */
export const VIEW_PLAYLIST_LABEL = 'View playlist';

/** Playlist chips on **public** `/catalog?view=playlists` (HER2+ and HR+). */
export const PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS: readonly PlaylistFocus[] = ['her2', 'hr'];

/** Parse `playlistFocus` from a location search string. */
export function parsePlaylistFocus(search: string): PlaylistFocus | null {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = p.get('playlistFocus');
  if (v && VALID_FOCUS.has(v)) return v as PlaylistFocus;
  return null;
}

/** Page `<h2>` on playlist browse when a focus is active. */
export function playlistBrowseHeading(focus: PlaylistFocus | null): string {
  if (!focus) return 'Playlists';
  const map: Record<PlaylistFocus, string> = {
    her2: 'HER2+ Conversations',
    hr: 'HR+ · CDK4/6 · Endocrine',
    'her2-low': 'HER2-Low / Ultra-Low',
    tnbc: 'TNBC & Triple Negative',
    'high-risk': 'High Risk Breast Cancer',
  };
  return map[focus] ?? 'Playlists';
}

/**
 * SCRUM-79 (2026-07-21): `filterPlaylistsByFocus` + `titleMatchesStrip`
 * removed. The regex playlist-title-match fallback caused the "10/27
 * resolvable" incident where playlist strips were populated from best-
 * guess title heuristics rather than curator intent.
 *
 * Callers are now tag-driven: fetch `/api/catalog/playlists-tags?tag=<X>`
 * (via `catalogApi.getPlaylistsTags`) and intersect the returned playlist
 * IDs against the YT metadata list from `catalogApi.getPlaylists()`.
 * See `Home.tsx her2PlaylistStrip` for the reference implementation.
 */
