import type { CatalogItem } from '../api/catalog';
import { APP_CATALOG_PLAYLIST_SECTIONS } from '../data/catalogPlaylistRows';

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

function titleMatchesStrip(playlistTitle: string, stripTitle: string): boolean {
  const norm = (s: string) => s.replace(/[\u2018\u2019']/g, "'").trim().toLowerCase();
  const a = norm(playlistTitle);
  const b = norm(stripTitle);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const n = Math.min(32, Math.min(a.length, b.length));
  if (n >= 14) return a.slice(0, n) === b.slice(0, n);
  return false;
}

function stripTitlesForFocus(focus: PlaylistFocus): string[] | null {
  const entry = APP_CATALOG_PLAYLIST_SECTIONS.find((s) => CATALOG_SECTION_TO_FOCUS[s.label] === focus);
  if (!entry) return null;
  return entry.items.map((i) => i.title);
}

/**
 * Narrow MediaHub playlist rows to those listed in `APP_CATALOG_PLAYLIST_SECTIONS` for this cohort.
 * Prefer clip-tag browsing via `PLAYLIST_FOCUS_TO_TAG` for focus chips; this remains for
 * optional playlist-title matching when needed.
 */
export function filterPlaylistsByFocus(playlists: CatalogItem[], focus: PlaylistFocus): CatalogItem[] {
  const stripTitles = stripTitlesForFocus(focus);
  if (stripTitles?.length) {
    const matched = playlists.filter((p) => stripTitles.some((st) => titleMatchesStrip(p.title, st)));
    if (matched.length > 0) return matched;
  }

  const t = (p: CatalogItem) => p.title ?? '';
  switch (focus) {
    case 'her2':
      return playlists.filter((p) => /HER2(?!-?[Ll]ow)|DESTINY-Breast|HER2\+|first-line/i.test(t(p)));
    case 'hr':
      return playlists.filter(
        (p) =>
          /HR\+|CDK4|endocrine/i.test(t(p)) &&
          !/HER2|DESTINY-Breast|TNBC|triple.?negative/i.test(t(p)),
      );
    case 'her2-low':
      return playlists.filter((p) => /HER2-?[Ll]ow|ultra-?low|DB-?04|DB-?06/i.test(t(p)));
    case 'tnbc':
      return playlists.filter((p) => /TNBC|triple.?negative|mTNBC/i.test(t(p)));
    case 'high-risk':
      return playlists.filter((p) => /high.?risk|CNS|brain.?met/i.test(t(p)));
    default:
      return playlists;
  }
}
