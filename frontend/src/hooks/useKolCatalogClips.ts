import { useQuery } from '@tanstack/react-query';
import { catalogApi, type MediaHubClip } from '../api/catalog';
import type { DolEntry } from '../data/dol-network';
import { kolCatalogDoctorSlugs } from '../utils/kol-catalog-link';
import { shouldSurfaceCatalogClip } from '../utils/clipUrl';

export type KolCatalogClipsResult = {
  clips: MediaHubClip[];
  total: number;
  doctorSlug: string;
  loadState: 'idle' | 'loading' | 'ready' | 'empty';
};

async function fetchClipsForKol(
  entry: Pick<DolEntry, 'id' | 'intel'>,
  limit: number,
): Promise<{ clips: MediaHubClip[]; total: number; doctorSlug: string }> {
  const slugs = kolCatalogDoctorSlugs(entry);
  if (slugs.length === 0) {
    return { clips: [], total: 0, doctorSlug: entry.id };
  }

  for (const doctor of slugs) {
    const { items, total } = await catalogApi.getClips({
      doctor,
      limit,
      sort_by: 'recorded_at',
      dedup_by: 'shoot',
      per_shoot_cap: 2,
    });
    const clips = items.filter(shouldSurfaceCatalogClip);
    if (clips.length > 0) {
      return { clips, total, doctorSlug: doctor };
    }
  }

  return { clips: [], total: 0, doctorSlug: slugs[0] };
}

export function useKolCatalogClips(
  entry: Pick<DolEntry, 'id' | 'intel' | 'shootCount'> | undefined,
  limit = 8,
): KolCatalogClipsResult {
  const enabled = Boolean(entry?.id?.trim());

  const { data, isLoading } = useQuery({
    queryKey: ['kol-network', 'catalog-clips', entry?.id, limit],
    queryFn: () => fetchClipsForKol(entry!, limit),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  if (!enabled) {
    return { clips: [], total: 0, doctorSlug: '', loadState: 'idle' };
  }
  if (isLoading) {
    return {
      clips: [],
      total: entry?.shootCount ?? 0,
      doctorSlug: kolCatalogDoctorSlugs(entry!)[0] ?? entry!.id,
      loadState: 'loading',
    };
  }
  if (!data || data.clips.length === 0) {
    return {
      clips: [],
      total: data?.total ?? entry?.shootCount ?? 0,
      doctorSlug: data?.doctorSlug ?? kolCatalogDoctorSlugs(entry!)[0] ?? entry!.id,
      loadState: 'empty',
    };
  }
  return { ...data, loadState: 'ready' };
}
