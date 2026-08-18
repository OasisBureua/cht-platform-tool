import { useMemo } from 'react';
import { Video, ListVideo, Eye } from 'lucide-react';
import type { DolEntry } from '../../data/dol-network';
import { KOL_PLAYLISTS } from '../../data/kol-playlists.generated';
import { useKolCatalogClips } from '../../hooks/useKolCatalogClips';
import { kolCatalogDoctorSlugs } from '../../utils/kol-catalog-link';

type Props = {
  entry: Pick<DolEntry, 'id' | 'name' | 'intel' | 'shootCount'>;
};

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * SCRUM-148: Engagement stats mini-strip on the KOL profile Engagement tab.
 * Shoots · Playlists featured in · Total clip views. Views come from live
 * MediaHub clip data via useKolCatalogClips; the other two are static.
 */
export function KolEngagementStats({ entry }: Props) {
  const { clips, loadState } = useKolCatalogClips(entry, 200);

  const stats = useMemo(() => {
    const slugs = kolCatalogDoctorSlugs(entry);
    const seenPlaylists = new Set<string>();
    for (const slug of slugs) {
      const hits = KOL_PLAYLISTS[slug.toLowerCase()];
      if (!hits) continue;
      for (const pl of hits) seenPlaylists.add(pl.id);
    }
    const totalViews = clips.reduce((sum, c) => sum + (c.view_count ?? 0), 0);
    return {
      shoots: entry.shootCount ?? 0,
      playlists: seenPlaylists.size,
      views: totalViews,
      viewsLoading: loadState === 'loading',
    };
  }, [entry, clips, loadState]);

  if (stats.shoots === 0 && stats.playlists === 0 && stats.views === 0 && !stats.viewsLoading) {
    return null;
  }

  return (
    <section
      aria-label="Engagement stats"
      className="grid grid-cols-3 gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-4"
    >
      <Tile icon={<Video className="h-4 w-4" aria-hidden />} label="Shoots" value={String(stats.shoots)} />
      <Tile
        icon={<ListVideo className="h-4 w-4" aria-hidden />}
        label={stats.playlists === 1 ? 'Playlist' : 'Playlists'}
        value={String(stats.playlists)}
      />
      <Tile
        icon={<Eye className="h-4 w-4" aria-hidden />}
        label="Clip views"
        value={stats.viewsLoading ? '—' : formatCompact(stats.views)}
      />
    </section>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-zinc-50 p-3 text-center dark:bg-zinc-900">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}
