import type { DolEntry } from '../data/dol-network';
import {
  extractKolLastName,
  lastNameSlugCandidates,
  matchCatalogDoctorSlugsByLastName,
} from './kol-catalog-doctor-match';

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

export function kolCatalogBrowseHref(
  entry: KolCatalogDoctorEntry,
  doctors?: { slug: string }[],
): string {
  const slug = kolCatalogDoctorSlugs(entry, doctors)[0] ?? entry.id;
  return `/catalog?${new URLSearchParams({ doctor: slug }).toString()}`;
}

export function kolCatalogClipHref(clipId: string): string {
  return `/catalog/clip/${encodeURIComponent(clipId)}`;
}
