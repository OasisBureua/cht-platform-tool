import { useQuery } from '@tanstack/react-query';
import { kolNetworkApi, type PublicKol } from '../api/kol-network';
import {
  kolStaticEnrichment,
  type DolEntry,
  type DolRegion,
  type KolIntel,
} from '../data/dol-network';

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
  };
}

function groupByRegion(items: PublicKol[]): DolRegion[] {
  const buckets = new Map<string, { label: string; entries: DolEntry[] }>();
  for (const item of items) {
    const region = item.region ?? 'unknown';
    const label = item.region_label ?? 'Other';
    if (!buckets.has(region)) buckets.set(region, { label, entries: [] });
    buckets.get(region)!.entries.push(mergeApiWithStatic(item));
  }
  return [...buckets.entries()]
    .map(([id, { label, entries }]) => ({
      id,
      title: label,
      entries,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
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
    regions: groupByRegion(data.items),
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

const SLUG_ALIASES: Record<string, string> = {
  yale: 'ny-northeast',
};

export function getRegionFromDirectory(
  directory: KolDirectory,
  slug: string,
): DolRegion | null {
  const resolved = SLUG_ALIASES[slug] ?? slug;
  return directory.regions.find((r) => r.id === resolved) ?? null;
}

// Re-export types so callers don't need to import from two places
export type { DolEntry, DolRegion, KolIntel };
