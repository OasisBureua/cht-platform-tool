import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import {
  buildCatalogSectionPlaylistsHref,
  CATALOG_SECTION_TO_FOCUS,
  parsePlaylistFocus,
  PLAYLIST_FOCUS_TO_TAG,
  type PlaylistFocus,
} from '../../utils/playlistFocusFilters';

type PlaylistFocusNavProps = {
  isInApp: boolean;
  /** Public `/catalog` playlist view: only HER2+ & HR+ chips. Omit on `/app/catalog` (show all cohorts). */
  allowedPlaylistFocusFilters?: readonly PlaylistFocus[];
};

/**
 * Playlist cohort pills: “All playlists” clears focus; each cohort matches `?playlistFocus=`.
 *
 * WPR-5: chip visibility is now gated by live ContentHub tag data. A chip renders
 * only when its underlying namespaced tag (e.g. biomarker:HER2+) has at least one
 * post behind it in the wp_tags projection. If live data hasn't loaded yet, all
 * chips render (permissive default preserves prior behaviour on cold cache).
 */
export function PlaylistFocusNav({ isInApp, allowedPlaylistFocusFilters }: PlaylistFocusNavProps) {
  const { search } = useLocation();
  const current = parsePlaylistFocus(search ?? '');
  const base = isInApp ? '/app/catalog' : '/catalog';
  const allHref = `${base}?view=playlists`;

  const { data: tagsData } = useQuery({
    queryKey: ['catalog', 'wordpress', 'tags'],
    queryFn: catalogApi.getWordPressTags,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const allowFocus = allowedPlaylistFocusFilters
    ? (f: PlaylistFocus) => allowedPlaylistFocusFilters.includes(f)
    : () => true;

  function linkClass(forFocus: PlaylistFocus | 'all'): string {
    const active = forFocus === 'all' ? current == null : current === forFocus;
    return [
      'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
      active
        ? 'bg-steel-600 text-white dark:bg-steel-500'
        : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
    ].join(' ');
  }

  // Set of namespaced tags present in live WP data with non-zero post count.
  const liveNamespacedTags = new Set(
    (tagsData?.items ?? [])
      .filter((t) => t.post_count > 0 && t.namespaced_tag)
      .map((t) => t.namespaced_tag as string),
  );

  function hasLiveContent(pf: PlaylistFocus): boolean {
    if (!tagsData) return true; // permissive during load
    const csv = PLAYLIST_FOCUS_TO_TAG[pf];
    if (!csv) return true;
    return csv.split(',').some((t) => liveNamespacedTags.has(t.trim()));
  }

  return (
    <nav className="-mx-1 flex flex-wrap items-center gap-2 pb-4 pt-1" aria-label="Playlist categories">
      <Link to={allHref} className={linkClass('all')}>
        All playlists
      </Link>
      {Object.entries(CATALOG_SECTION_TO_FOCUS).map(([label, pf]) => {
        if (!allowFocus(pf)) return null;
        if (!hasLiveContent(pf)) return null;
        const to = buildCatalogSectionPlaylistsHref(isInApp, label);
        return (
          <Link key={label} to={to} className={linkClass(pf)}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
