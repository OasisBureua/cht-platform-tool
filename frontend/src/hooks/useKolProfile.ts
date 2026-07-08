import { useQuery } from '@tanstack/react-query';
import { kolNetworkApi } from '../api/kol-network';
import { type DolEntry } from '../data/dol-network';
import { US_STATES, usStateLabel } from '../data/us-states';
import { mergePublicKolToEntry } from '../utils/kol-directory-merge';
import type { DolRegion } from './useKolDirectory';

export type KolProfile = {
  region: DolRegion;
  entry: DolEntry;
  loadState: 'idle' | 'loading' | 'error' | 'ready' | 'not-found';
};

function regionForEntry(entry: DolEntry): DolRegion {
  const code = entry.stateCode ?? 'UNKNOWN';
  return {
    id: code,
    title: code === 'UNKNOWN' ? 'State unknown' : usStateLabel(code),
    entries: [entry],
  };
}

export function useKolProfile(
  slug: string | undefined,
  surface: 'public' | 'app' = 'public',
): KolProfile {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kol-network', 'profile', slug, surface],
    queryFn: () => kolNetworkApi.get(slug!, surface),
    enabled: Boolean(slug?.trim()),
    staleTime: 60_000,
  });

  if (!slug?.trim()) {
    return {
      region: { id: 'UNKNOWN', title: 'State unknown', entries: [] },
      entry: { id: '', name: '', role: '', bio: '', education: '' },
      loadState: 'not-found',
    };
  }

  if (isLoading) {
    return {
      region: { id: 'UNKNOWN', title: 'State unknown', entries: [] },
      entry: { id: slug, name: '', role: '', bio: '', education: '' },
      loadState: 'loading',
    };
  }

  if (isError || !data) {
    return {
      region: { id: 'UNKNOWN', title: 'State unknown', entries: [] },
      entry: { id: slug, name: '', role: '', bio: '', education: '' },
      loadState: 'not-found',
    };
  }

  const entry = mergePublicKolToEntry(data);
  return {
    region: regionForEntry(entry),
    entry,
    loadState: 'ready',
  };
}
