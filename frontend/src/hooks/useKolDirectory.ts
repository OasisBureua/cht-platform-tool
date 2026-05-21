import { useQuery } from '@tanstack/react-query';
import { kolNetworkApi, type PublicKol } from '../api/kol-network';
import {
  kolStaticEnrichment,
  type DolEntry,
  type DolRegion,
  type KolIntel,
} from '../data/dol-network';
import { US_STATES, usStateLabel } from '../data/us-states';
import { deriveKolUsState } from '../utils/kol-state';

/**
 * Hydrate API roster with static intel (NPI, AI brief, social URLs, etc.).
 * MediaHub is the source of truth for *who* is in the directory; the static
 * file is mock-only enrichment until MediaHub emits the same fields.
 */
function mergeApiWithStatic(apiKol: PublicKol): DolEntry {
  const stat = kolStaticEnrichment.find((e) => e.id === apiKol.slug);
  return {
    id: apiKol.slug,
    name: apiKol.name,
    role: stat?.role ?? apiKol.title ?? '',
    bio: apiKol.bio || stat?.bio || '',
    education: stat?.education ?? '',
    isNew: apiKol.is_new || stat?.isNew,
    addedAt: stat?.addedAt,
    photoUrl: apiKol.photo_url ?? undefined,
    shootCount: apiKol.shoot_count,
    intel: stat?.intel,
    stateCode: deriveKolUsState(apiKol, stat) ?? undefined,
  };
}

/** Group KOLs by US state (50 states + DC); unknown state last. */
function groupByUsState(items: PublicKol[]): DolRegion[] {
  const buckets = new Map<string, DolEntry[]>();
  for (const item of items) {
    const entry = mergeApiWithStatic(item);
    const code = entry.stateCode ?? 'UNKNOWN';
    if (!buckets.has(code)) buckets.set(code, []);
    buckets.get(code)!.push(entry);
  }

  const orderedCodes = [
    ...US_STATES.map((s) => s.value),
    ...(buckets.has('UNKNOWN') ? ['UNKNOWN'] : []),
  ];

  return orderedCodes
    .filter((code) => buckets.has(code))
    .map((code) => ({
      id: code,
      title: code === 'UNKNOWN' ? 'State unknown' : usStateLabel(code),
      entries: buckets.get(code)!.sort((a, b) => {
        const an = a.name.replace(/^Dr\.\s*/i, '').toLowerCase();
        const bn = b.name.replace(/^Dr\.\s*/i, '').toLowerCase();
        return an.localeCompare(bn, undefined, { sensitivity: 'base' });
      }),
    }));
}

export type KolDirectory = {
  regions: DolRegion[];
  total: number;
  loadState: 'idle' | 'loading' | 'error' | 'ready';
};

export function useKolDirectory(): KolDirectory {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kol-network', 'list'],
    queryFn: () => kolNetworkApi.list({ limit: 200 }),
    staleTime: 60_000,
  });

  if (isLoading) return { regions: [], total: 0, loadState: 'loading' };
  if (isError || !data) return { regions: [], total: 0, loadState: 'error' };

  return {
    regions: groupByUsState(data.items),
    total: data.total,
    loadState: 'ready',
  };
}

/** Find one KOL by slug, merged with static intel. */
export function findKolInDirectory(
  directory: KolDirectory,
  slug: string,
): { region: DolRegion; entry: DolEntry } | null {
  for (const region of directory.regions) {
    const entry = region.entries.find((e) => e.id === slug);
    if (entry) return { region, entry };
  }
  return null;
}

/** Resolve a state section by 2-letter code (e.g. NY). */
export function getRegionFromDirectory(
  directory: KolDirectory,
  stateCode: string,
): DolRegion | null {
  const code = stateCode.toUpperCase();
  return directory.regions.find((r) => r.id === code) ?? null;
}

// Re-export types so callers don't need to import from two places
export type { DolEntry, DolRegion, KolIntel };
