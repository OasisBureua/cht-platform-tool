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

type KolClipEntry = Pick<DolEntry, 'id' | 'name' | 'intel'>;

async function fetchClipsForKol(
  entry: KolClipEntry,
  limit: number,
  doctors: { slug: string }[],
): Promise<{ clips: MediaHubClip[]; total: number; doctorSlug: string }> {
  const slugs = kolCatalogDoctorSlugs(entry, doctors);
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
  entry: Pick<DolEntry, 'id' | 'name' | 'intel' | 'shootCount'> | undefined,
  limit = 8,
): KolCatalogClipsResult {
  const enabled = Boolean(entry?.id?.trim());

  const { data: doctors = [] } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: () => catalogApi.getDoctors(),
    staleTime: 30 * 60 * 1000,
    enabled,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['kol-network', 'catalog-clips', entry?.id, entry?.name, limit, doctors.length],
    queryFn: () => fetchClipsForKol(entry!, limit, doctors),
    enabled: enabled && doctors.length >= 0,
    staleTime: 5 * 60 * 1000,
  });

  const slugPreview = entry
    ? kolCatalogDoctorSlugs(entry, doctors)[0] ?? entry.id
    : '';

  if (!enabled) {
    return { clips: [], total: 0, doctorSlug: '', loadState: 'idle' };
  }
  if (isLoading) {
    return {
      clips: [],
      total: entry?.shootCount ?? 0,
      doctorSlug: slugPreview,
      loadState: 'loading',
    };
  }
  if (!data || data.clips.length === 0) {
    return {
      clips: [],
      total: data?.total ?? entry?.shootCount ?? 0,
      doctorSlug: data?.doctorSlug ?? slugPreview,
      loadState: 'empty',
    };
  }
  return { ...data, loadState: 'ready' };
}
