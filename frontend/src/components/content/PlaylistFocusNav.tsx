import { Link, useLocation } from 'react-router-dom';
import { APP_CATALOG_PLAYLIST_SECTIONS } from '../../data/catalogPlaylistRows';
import {
  buildCatalogSectionPlaylistsHref,
  CATALOG_SECTION_TO_FOCUS,
  parsePlaylistFocus,
  type PlaylistFocus,
} from '../../utils/playlistFocusFilters';

type PlaylistFocusNavProps = {
  isInApp: boolean;
  /** Public `/catalog` playlist view: only HER2+ & HR+ chips. Omit on `/app/catalog` (show all cohorts). */
  allowedPlaylistFocusFilters?: readonly PlaylistFocus[];
};

/**
 * Playlist cohort pills — “All playlists” clears focus; each cohort matches `?playlistFocus=`.
 */
export function PlaylistFocusNav({ isInApp, allowedPlaylistFocusFilters }: PlaylistFocusNavProps) {
  const { search } = useLocation();
  const current = parsePlaylistFocus(search ?? '');
  const base = isInApp ? '/app/catalog' : '/catalog';
  const allHref = `${base}?view=playlists`;

  const allowFocus = allowedPlaylistFocusFilters
    ? (f: PlaylistFocus) => allowedPlaylistFocusFilters.includes(f)
    : () => true;

  function linkClass(forFocus: PlaylistFocus | 'all'): string {
    const active = forFocus === 'all' ? current == null : current === forFocus;
    return [
      'shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-colors',
      active
        ? 'bg-brand-600 text-white dark:bg-brand-500'
        : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700',
    ].join(' ');
  }

  return (
    <nav className="-mx-1 flex flex-wrap items-center gap-2 pb-4 pt-1" aria-label="Playlist categories">
      <Link to={allHref} className={linkClass('all')}>
        All playlists
      </Link>
      {APP_CATALOG_PLAYLIST_SECTIONS.map((section) => {
        const pf = CATALOG_SECTION_TO_FOCUS[section.label];
        if (!pf || !allowFocus(pf)) return null;
        const to = buildCatalogSectionPlaylistsHref(isInApp, section.label);
        return (
          <Link key={section.label} to={to} className={linkClass(pf)} title={section.subtitle}>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
