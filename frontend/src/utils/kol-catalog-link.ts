import type { DolEntry } from '../data/dol-network';
import {
  extractKolLastName,
  lastNameSlugCandidates,
  matchCatalogDoctorSlugsByLastName,
} from './kol-catalog-doctor-match';
import { kolCatalogBaseFromPath } from './kol-network-paths';

export type KolCatalogDoctorEntry = Pick<DolEntry, 'id' | 'name' | 'intel'>;

/** MediaHub doctor tag slugs to try when resolving clips for a KOL profile. */
export function kolCatalogDoctorSlugs(
  entry: KolCatalogDoctorEntry,
  doctors?: { slug: string }[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string | null) => {
    const s = raw?.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };

  add(entry.intel?.catalogDoctorSlug);
  add(entry.id);
  if (entry.id?.trim() && !/^dr-/i.test(entry.id.trim())) {
    add(`dr-${entry.id.trim()}`);
  }

  const lastName = extractKolLastName(entry.name ?? '');
  if (lastName) {
    for (const slug of lastNameSlugCandidates(lastName)) {
      add(slug);
    }
    if (doctors?.length) {
      for (const slug of matchCatalogDoctorSlugsByLastName(lastName, doctors, entry.id)) {
        add(slug);
      }
    }
  }

  return out;
}

/**
 * Catalog browse URL filtered to this KOL's doctor tag.
 * Always stays on the current surface (`/catalog` or `/app/catalog`) so
 * in-app "View all" never drops to the marketing homepage via catch-all.
 */
export function kolCatalogBrowseHref(
  entry: KolCatalogDoctorEntry,
  doctorsOrPathname?: { slug: string }[] | string,
  pathname?: string,
): string {
  const doctors = Array.isArray(doctorsOrPathname) ? doctorsOrPathname : undefined;
  const path =
    typeof doctorsOrPathname === 'string'
      ? doctorsOrPathname
      : pathname ??
        (typeof window !== 'undefined' ? window.location.pathname : '');
  const base = kolCatalogBaseFromPath(path);
  const slug = kolCatalogDoctorSlugs(entry, doctors)[0] ?? entry.id?.trim();
  if (!slug) {
    // Never emit a bare "/" or empty path — that routes to the homepage.
    return base;
  }
  return `${base}?${new URLSearchParams({ doctor: slug }).toString()}`;
}

export function kolCatalogClipHref(clipId: string, pathname?: string): string {
  const path =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  const base = path.startsWith('/app') ? '/app/clip' : '/catalog/clip';
  return `${base}/${encodeURIComponent(clipId)}`;
}
