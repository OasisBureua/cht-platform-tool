import { useQuery } from '@tanstack/react-query';
import { kolNetworkApi } from '../api/kol-network';
import { type DolEntry, type DolRegion } from '../data/dol-network';
import { US_STATES, usStateLabel } from '../data/us-states';
import { mergePublicKolToEntry } from '../utils/kol-directory-merge';

export type KolListFilters = {
  /** Server-side search (name, institution, specialty, bio). */
  q?: string;
  /** Exact institution match, use values from API `institutions` facet. */
  institution?: string;
  new_only?: boolean;
  /** `public` = marketing site; `app` = in-app CHM Docs */
  surface?: 'public' | 'app';
};

/** Group merged entries by US state (50 states + DC); unknown state last. */
function groupByUsState(entries: DolEntry[]): DolRegion[] {
  const buckets = new Map<string, DolEntry[]>();
  for (const entry of entries) {
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
  /** Total from API after server filters (before client state filter). */
  total: number;
  /** Institution facet from API for the current filter set. */
  institutions: string[];
  loadState: 'idle' | 'loading' | 'error' | 'ready';
};

export function useKolDirectory(filters: KolListFilters = {}): KolDirectory {
  const normalized: KolListFilters = {
    q: filters.q?.trim() || undefined,
    institution: filters.institution?.trim() || undefined,
    new_only: filters.new_only || undefined,
    surface: filters.surface,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['kol-network', 'list', normalized],
    queryFn: () =>
      kolNetworkApi.list({
        q: normalized.q,
        institution: normalized.institution,
        new_only: normalized.new_only,
        surface: normalized.surface,
        limit: 200,
      }),
    staleTime: 60_000,
  });

  if (isLoading) {
    return { regions: [], total: 0, institutions: [], loadState: 'loading' };
  }
  if (isError || !data) {
    return { regions: [], total: 0, institutions: [], loadState: 'error' };
  }

  const entries = data.items.map(mergePublicKolToEntry);

  return {
    regions: groupByUsState(entries),
    total: data.total,
    institutions: data.institutions ?? [],
    loadState: 'ready',
  };
}

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

export function getRegionFromDirectory(
  directory: KolDirectory,
  stateCode: string,
): DolRegion | null {
  const code = stateCode.toUpperCase();
  return directory.regions.find((r) => r.id === code) ?? null;
}

export type { DolEntry, DolRegion };
export type { KolIntel } from '../data/dol-network';
