import { Link, useLocation } from 'react-router-dom';
import { Monitor, ClipboardList, ListVideo, Library } from 'lucide-react';

export type LibraryViewMode = 'clips' | 'playlists';

function tabClass(active: boolean) {
  return [
    'flex flex-col items-center gap-2 transition-colors min-w-[3.5rem]',
    active ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900',
  ].join(' ');
}

type ContentLibraryNavTabsProps = {
  isInApp: boolean;
  libraryView: LibraryViewMode;
  playlistsAvailable: boolean;
  onSelectClips: () => void;
  onSelectPlaylists: () => void;
};

/**
 * Shared icon nav: Catalog (clips + filters + playlists), Conversations (LIVE), Surveys, Playlists.
 */
export function ContentLibraryNavTabs({
  isInApp,
  libraryView,
  playlistsAvailable,
  onSelectClips,
  onSelectPlaylists,
}: ContentLibraryNavTabsProps) {
  const { pathname } = useLocation();
  const base = isInApp ? '/app' : '';
  const catalogTo = base ? '/app/catalog' : '/catalog';
  const webinarsTo = base ? '/app/webinars' : '/webinars';
  const surveysTo = base ? '/app/surveys' : '/surveys';

  const onCatalogHub =
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/app/catalog') ||
    pathname === '/watch' ||
    pathname === '/app/watch';

  const catalogTabActive = onCatalogHub && libraryView === 'clips';
  const playlistsTabActive = libraryView === 'playlists';

  return (
    <section className="flex flex-wrap gap-4" aria-label="Content library sections">
      <Link to={catalogTo} className={tabClass(catalogTabActive)} onClick={() => onSelectClips()}>
        <ListVideo className="h-8 w-8" />
        <span className="text-sm font-medium">Catalog</span>
      </Link>
      <Link to={webinarsTo} className={tabClass(false)}>
        <Monitor className="h-8 w-8" />
        <span className="text-sm font-medium">Conversations</span>
      </Link>
      <Link to={surveysTo} className={tabClass(false)}>
        <ClipboardList className="h-8 w-8" />
        <span className="text-sm font-medium">Surveys</span>
      </Link>
      {playlistsAvailable ? (
        <button
          type="button"
          className={tabClass(playlistsTabActive)}
          onClick={onSelectPlaylists}
          aria-pressed={playlistsTabActive}
        >
          <Library className="h-8 w-8" />
          <span className="text-sm font-medium">Playlists</span>
        </button>
      ) : null}
    </section>
  );
}
