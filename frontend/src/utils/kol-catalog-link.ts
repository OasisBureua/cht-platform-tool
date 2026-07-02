import type { DolEntry } from '../data/dol-network';

/** MediaHub doctor tag slugs to try when resolving clips for a KOL profile. */
export function kolCatalogDoctorSlugs(entry: Pick<DolEntry, 'id' | 'intel'>): string[] {
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
  return out;
}

export function kolCatalogBrowseHref(entry: Pick<DolEntry, 'id' | 'intel'>): string {
  const slug = kolCatalogDoctorSlugs(entry)[0] ?? entry.id;
  return `/catalog?${new URLSearchParams({ doctor: slug }).toString()}`;
}

export function kolCatalogClipHref(clipId: string): string {
  return `/catalog/clip/${encodeURIComponent(clipId)}`;
}
