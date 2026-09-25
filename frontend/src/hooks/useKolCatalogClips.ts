import { useQuery } from '@tanstack/react-query';
import { catalogApi, type ContentHubClip } from '../api/catalog';
import type { DolEntry } from '../data/dol-network';
import { kolCatalogDoctorSlugs } from '../utils/kol-catalog-link';
import { shouldSurfaceCatalogClip } from '../utils/clipUrl';

export type KolCatalogClipsResult = {
  clips: ContentHubClip[];
  total: number;
  doctorSlug: string;
  loadState: 'idle' | 'loading' | 'ready' | 'empty';
};

type KolClipEntry = Pick<DolEntry, 'id' | 'name' | 'intel'>;

/** ContentHub often returns `total === items.length`, so we page to count. */
const COUNT_PAGE_SIZE = 50;
const COUNT_PAGE_CAP = 20;

async function fetchClipsForKol(
  entry: KolClipEntry,
  limit: number,
  doctors: { slug: string }[],
): Promise<{ clips: ContentHubClip[]; total: number; doctorSlug: string }> {
  const slugs = kolCatalogDoctorSlugs(entry, doctors);
  if (slugs.length === 0) {
    return { clips: [], total: 0, doctorSlug: entry.id };
  }

  // Match catalog "View all" for this doctor: no per-shoot cap / shoot
  // dedup. Page until a short page so the video count is real (ContentHub
  // `total` is unreliable when it equals the page size).
  for (const doctor of slugs) {
    const surfaced: ContentHubClip[] = [];
    let offset = 0;

    for (let page = 0; page < COUNT_PAGE_CAP; page += 1) {
      const { items } = await catalogApi.getClips({
        doctor,
        limit: COUNT_PAGE_SIZE,
        offset,
        sort_by: 'recorded_at',
      });
      surfaced.push(...items.filter(shouldSurfaceCatalogClip));
      if (items.length < COUNT_PAGE_SIZE) break;
      offset += COUNT_PAGE_SIZE;
    }

    if (surfaced.length > 0) {
      return {
        clips: surfaced.slice(0, limit),
        total: surfaced.length,
        doctorSlug: doctor,
      };
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
