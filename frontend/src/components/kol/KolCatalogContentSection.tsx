import { Link } from 'react-router-dom';
import { ArrowRight, Film, Loader2 } from 'lucide-react';
import type { DolEntry } from '../../data/dol-network';
import { useKolCatalogClips } from '../../hooks/useKolCatalogClips';
import { kolCatalogBrowseHref, kolCatalogClipHref } from '../../utils/kol-catalog-link';
import { ConversationsClipCard } from '../content/ConversationsClipCard';
import { ConversationRow } from '../home/ConversationRow';

type Props = {
  entry: DolEntry;
  /** Overview = card below intel; engagement = primary tab content */
  variant?: 'overview' | 'engagement';
  limit?: number;
};

export function KolCatalogContentSection({ entry, variant = 'overview', limit = 8 }: Props) {
  const { clips, total, loadState } = useKolCatalogClips(entry, limit);
  const browseHref = kolCatalogBrowseHref(entry);
  const shootLabel =
    entry.shootCount && entry.shootCount > 0
      ? `${entry.shootCount} CHM shoot${entry.shootCount === 1 ? '' : 's'}`
      : total > 0
        ? `${total} video${total === 1 ? '' : 's'} in catalog`
        : null;

  if (loadState === 'loading') {
    return (
      <article className="rounded-card border border-border bg-card p-6 shadow-sm ">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading CHM content…
        </div>
      </article>
    );
  }

  if (loadState === 'empty') {
    if (variant === 'overview') return null;
    return (
      <article className="rounded-card border border-dashed border-border bg-card px-4 py-10 text-center shadow-sm ">
        <Film className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 text-base font-bold text-foreground">No catalog videos yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          When this physician appears in Community Health Media conversations, their videos will show here and in the
          catalog.
        </p>
        <Link
          to={browseHref}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline dark:text-brand-400"
        >
          Browse all catalog content
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </article>
    );
  }

  if (variant === 'engagement') {
    return (
      <article className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
        <ConversationRow
          title="CHM catalog content"
          subtitle={shootLabel ?? undefined}
          seeAllHref={browseHref}
          seeAllLabel="View all"
        >
          {clips.map((clip) => (
            <div key={clip.id} className="w-56 shrink-0 sm:w-64" style={{ scrollSnapAlign: 'start' }}>
              <ConversationsClipCard item={clip} href={kolCatalogClipHref(clip.id)} />
            </div>
          ))}
        </ConversationRow>
      </article>
    );
  }

  return (
    <article className="rounded-card border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Film className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden />
            CHM catalog content
          </h2>
          {shootLabel ? (
            <p className="mt-1 text-xs text-muted-foreground">{shootLabel}</p>
          ) : null}
        </div>
        <Link
          to={browseHref}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-[6px] border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {clips.map((clip) => (
          <ConversationsClipCard key={clip.id} item={clip} href={kolCatalogClipHref(clip.id)} />
        ))}
      </div>
    </article>
  );
}
