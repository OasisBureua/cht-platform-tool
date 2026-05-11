import { parsePlaylistFocus } from './playlistFocusFilters';

/** Public `/catalog` `?view=` — must stay aligned with VideosPage.effectiveLibraryView. */
export function getPublicLibraryViewFromSearch(search: string): 'clips' | 'playlists' {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = p.get('view');
  if (view === 'clips') return 'clips';
  if (view === 'playlists') return 'playlists';
  const hasFilters =
    !!(p.get('q')?.trim()) ||
    !!p.get('tag') ||
    !!p.get('doctor') ||
    !!(p.get('sort') || p.get('sort_by'));
  return hasFilters ? 'clips' : 'playlists';
}

/**
 * Fingerprint for catalog browse destinations so we can detect when React Router will no-op navigation
 * (e.g. /app/catalog vs /app/catalog?view=clips — same clips UI) and scroll instead.
 */
export function catalogConversationBrowseFinger(pathname: string, searchRaw: string): string | null {
  if (pathname !== '/catalog' && pathname !== '/app/catalog') {
    return null;
  }

  const p = new URLSearchParams(searchRaw.startsWith('?') ? searchRaw.slice(1) : searchRaw);
  const isApp = pathname.startsWith('/app');

  const q = (p.get('q') ?? '').trim();
  const tag = (p.get('tag') ?? '').trim();
  const doctor = (p.get('doctor') ?? '').trim();
  const sort = (p.get('sort') ?? p.get('sort_by') ?? '').trim();
  const hasFilters = !!(q || tag || doctor || sort);

  let tab: 'clips' | 'playlists';
  if (isApp) {
    tab = p.get('view') === 'playlists' ? 'playlists' : 'clips';
  } else if (hasFilters) {
    tab = 'clips';
  } else {
    const pv = p.get('view');
    if (pv === 'clips' || pv === 'playlists') tab = pv === 'playlists' ? 'playlists' : 'clips';
    else tab = 'playlists';
  }

  const searchForFocus = searchRaw
    ? searchRaw.startsWith('?')
      ? searchRaw
      : `?${searchRaw}`
    : '';
  const playlistFocus =
    tab === 'playlists' ? parsePlaylistFocus(searchForFocus) : null;

  return JSON.stringify({
    pathname,
    tab,
    playlistFocus,
    filters: [q || null, tag || null, doctor || null, sort || null],
  });
}

export function catalogConversationBrowseFingerFromLocation(loc: { pathname: string; search?: string }): string | null {
  const s = loc.search?.startsWith('?') ? loc.search.slice(1) : loc.search ?? '';
  return catalogConversationBrowseFinger(loc.pathname, s);
}

/** `seeAllHref` is an in-app pathname + optional query, e.g. `/app/catalog?view=clips`. */
export function catalogConversationBrowseFingerFromHref(seeAllHref: string): string | null {
  const t = seeAllHref.trim();
  const qi = t.indexOf('?');
  const pathname = qi >= 0 ? t.slice(0, qi) : t;
  const search = qi >= 0 ? t.slice(qi + 1) : '';
  return catalogConversationBrowseFinger(pathname, search);
}
