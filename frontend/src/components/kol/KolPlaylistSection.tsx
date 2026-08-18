import { Link } from 'react-router-dom';
import { ArrowRight, ListVideo } from 'lucide-react';
import type { DolEntry } from '../../data/dol-network';
import { KOL_PLAYLISTS, type KolPlaylistRef } from '../../data/kol-playlists.generated';
import { kolCatalogDoctorSlugs } from '../../utils/kol-catalog-link';

type Props = {
  entry: Pick<DolEntry, 'id' | 'name' | 'intel'>;
  limit?: number;
};

/**
 * SCRUM-148: Playlists a KOL appears in, shown on the KOL profile Engagement tab.
 * Reads from a static map (frontend/src/data/kol-playlists.generated.ts) — see
 * frontend/scripts/generate-kol-playlists.mjs to regenerate.
 */
export function KolPlaylistSection({ entry, limit = 8 }: Props) {
  const playlists = resolvePlaylistsForKol(entry, limit);
  if (playlists.length === 0) return null;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <ListVideo className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
            Featured in playlists
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {playlists.length} playlist{playlists.length === 1 ? '' : 's'} on Community Health Media
          </p>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {playlists.map((pl) => (
          <li key={pl.id}>
            <Link
              to={`/catalog/playlist/${encodeURIComponent(pl.id)}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:border-brand-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-brand-700"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {pl.thumbnailUrl ? (
                  <img
                    src={pl.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : null}
                <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                  {pl.videoCount} video{pl.videoCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3">
                <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {pl.title}
                </h3>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-brand-700 dark:text-brand-400">
                  View playlist
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Resolve playlists for a KOL by trying every candidate doctor slug the KOL
 * profile maps to (same slug resolution used by useKolCatalogClips).
 * De-dupes by playlist id across slug candidates.
 */
function resolvePlaylistsForKol(
  entry: Pick<DolEntry, 'id' | 'name' | 'intel'>,
  limit: number,
): KolPlaylistRef[] {
  const slugs = kolCatalogDoctorSlugs(entry);
  const seen = new Set<string>();
  const out: KolPlaylistRef[] = [];
  for (const slug of slugs) {
    const hits = KOL_PLAYLISTS[slug.toLowerCase()];
    if (!hits) continue;
    for (const pl of hits) {
      if (seen.has(pl.id)) continue;
      seen.add(pl.id);
      out.push(pl);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
