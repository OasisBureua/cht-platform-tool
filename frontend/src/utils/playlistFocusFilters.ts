import type { CatalogItem } from '../api/catalog';
import type { AppPlaylistSection } from '../data/catalogPlaylistRows';
import { APP_CATALOG_PLAYLIST_SECTIONS } from '../data/catalogPlaylistRows';

/** URL `?playlistFocus=` — home row links + curated catalogue “View videos” rows per section. (`hr` matches home + HR strip.) */
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

export function buildCatalogSectionPlaylistsHref(isInApp: boolean, sectionLabel: string): string {
  const focus = CATALOG_SECTION_TO_FOCUS[sectionLabel];
  const base = isInApp ? '/app/catalog' : '/catalog';
  if (!focus) return `${base}?view=playlists`;
  return `${base}?view=playlists&playlistFocus=${encodeURIComponent(focus)}`;
}

/**
 * Canonical CHM browse targets for curated strips — “See all” opens off-platform here.
 * Override per section with optional `browseHref` on `AppPlaylistSection` in `_generated-catalog-playlists.json`.
 */
export const CATALOG_SECTION_EXTERNAL_BROWSE_URL: Partial<Record<string, string>> = {
  'HER2+ Conversations':
    'https://communityhealth.media/her2-breast-cancer-the-most-transformed-disease-in-oncology/',
  'HER2-Low / Ultra-Low': 'https://communityhealth.media/her2-low-biomarker-not-driver/',
  'HR+ · CDK4/6 · Endocrine':
    'https://communityhealth.media/parp-vs-cdk4-6-inhibitors-which-comes-first-in-hr-brca-disease/',
  'TNBC & Triple Negative': 'https://communityhealth.media/series/iyengar-hamilton/',
  'High Risk Breast Cancer':
    'https://communityhealth.media/neoadjuvant-t-dxd-why-destiny-breast11-data-turned-heads/',
};

/** Public home HER2+ / HR+ strips (narrower titles — same cohort browse intent as curated catalogue sections). */
export const HOMEPAGE_HER2_STRIP_SEE_ALL_HREF = CATALOG_SECTION_EXTERNAL_BROWSE_URL['HER2+ Conversations']!;
export const HOMEPAGE_HR_STRIP_SEE_ALL_HREF = CATALOG_SECTION_EXTERNAL_BROWSE_URL['HR+ · CDK4/6 · Endocrine']!;

/** Link label for curated catalog rows (“View playlist” opens CHM browse when external href is configured). */
export const VIEW_PLAYLIST_LABEL = 'View playlist';

/**
 * Prefer off-platform editorial browse; optional JSON `browseHref`; else in-app playlists + focus filter.
 */
export function resolveCatalogSectionSeeAllHref(isInApp: boolean, section: AppPlaylistSection): string {
  const trimmed = section.browseHref?.trim();
  if (trimmed) return trimmed;
  const ext = CATALOG_SECTION_EXTERNAL_BROWSE_URL[section.label];
  if (ext) return ext;
  return buildCatalogSectionPlaylistsHref(isInApp, section.label);
}

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
    her2: 'HER2+',
    hr: 'HR+',
    'her2-low': 'HER2-Low / Ultra-Low',
    tnbc: 'TNBC & Triple Negative',
    'high-risk': 'High Risk Breast Cancer',
  };
  return map[focus] ?? 'Playlists';
}

function titleMatchesStrip(playlistTitle: string, stripTitle: string): boolean {
  const norm = (s: string) => s.replace(/[\u2018\u2019]/g, "'").trim().toLowerCase();
  const a = norm(playlistTitle);
  const b = norm(stripTitle);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const n = Math.min(32, Math.min(a.length, b.length));
  if (n >= 14) return a.slice(0, n) === b.slice(0, n);
  return false;
}

/** Playlists belonging to one curated dashboard strip (`section.label` ↔ `playlistFocus`). */
function stripTitlesForFocus(focus: PlaylistFocus): string[] | null {
  const entry = APP_CATALOG_PLAYLIST_SECTIONS.find((s) => CATALOG_SECTION_TO_FOCUS[s.label] === focus);
  if (!entry) return null;
  return entry.items.map((i) => i.title);
}

/**
 * Narrow MediaHub playlist rows to those listed in `APP_CATALOG_PLAYLIST_SECTIONS` for this cohort.
 */
export function filterPlaylistsByFocus(playlists: CatalogItem[], focus: PlaylistFocus): CatalogItem[] {
  const stripTitles = stripTitlesForFocus(focus);
  if (stripTitles?.length) {
    return playlists.filter((p) =>
      stripTitles.some((st) => titleMatchesStrip(p.title, st)),
    );
  }

  /** Fallback if JSON is out of sync with `focus`. */
  const t = (p: CatalogItem) => p.title ?? '';
  switch (focus) {
    case 'her2':
      return playlists.filter((p) => /HER2|DESTINY-Breast|HER2\+|first-line/i.test(t(p)));
    case 'hr':
      return playlists.filter(
        (p) =>
          /HR\+|TNBC|mTNBC|CDK4|endocrine|triple.?negative|PARP/i.test(t(p)) &&
          !/HER2|DESTINY-Breast(?:02|06|07|03)/i.test(t(p)),
      );
    case 'her2-low':
    case 'tnbc':
    case 'high-risk':
      return [];
    default:
      return playlists;
  }
}
