import { Link, useLocation } from 'react-router-dom';
import { Monitor, ListVideo, Library } from 'lucide-react';

function tabClass(active: boolean) {
  return [
    'flex flex-col items-center gap-2 transition-colors min-w-[3.5rem]',
    active ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900',
  ].join(' ');
}

type ContentLibraryNavTabsProps = {
  isInApp: boolean;
};

/** Clips vs playlists for tab highlighting — matches VideosPage URL rules. */
function effectiveContentView(search: string): 'clips' | 'playlists' {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const v = p.get('view');
  if (v === 'clips') return 'clips';
  if (v === 'playlists') return 'playlists';
  const hasFilters =
    !!(p.get('q')?.trim()) ||
    !!p.get('tag') ||
    !!p.get('doctor') ||
    !!(p.get('sort') || p.get('sort_by'));
  return hasFilters ? 'clips' : 'playlists';
}

/**
 * Icon nav under the public content library: Catalog (clips), Conversations (Live), Playlists.
 */
export function ContentLibraryNavTabs({ isInApp }: ContentLibraryNavTabsProps) {
  const { pathname, search } = useLocation();
  const catalogPath = isInApp ? '/app/catalog' : '/catalog';
  const liveTo = isInApp ? '/app/live' : '/live';

  const hrefWithView = (view: 'clips' | 'playlists') => {
    const p = new URLSearchParams(search);
    p.set('view', view);
    if (view === 'clips') p.delete('playlistFocus');
    const qs = p.toString();
    return qs ? `${catalogPath}?${qs}` : `${catalogPath}?view=${view}`;
  };

  const onCatalogHub =
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/app/catalog') ||
    pathname === '/watch' ||
    pathname === '/app/watch';

  const activeView = effectiveContentView(search);
  const catalogTabActive = onCatalogHub && activeView === 'clips';
  const playlistsTabActive = activeView === 'playlists';

  return (
    <section className="flex flex-wrap gap-4" aria-label="Content library sections">
      <Link to={hrefWithView('clips')} className={tabClass(catalogTabActive)}>
        <ListVideo className="h-8 w-8" />
        <span className="text-sm font-medium">Catalog</span>
      </Link>
      <Link to={liveTo} className={tabClass(false)}>
        <Monitor className="h-8 w-8" />
        <span className="text-sm font-medium">Conversations</span>
      </Link>
      <Link
        to={hrefWithView('playlists')}
        className={tabClass(playlistsTabActive)}
        aria-current={playlistsTabActive ? 'page' : undefined}
      >
        <Library className="h-8 w-8" />
        <span className="text-sm font-medium">Playlists</span>
      </Link>
    </section>
  );
}
