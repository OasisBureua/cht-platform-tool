import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { Search, Loader2, ChevronDown, MonitorPlay } from 'lucide-react';
import { catalogApi, type MediaHubTags } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail, shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { ContentLibraryNavTabs } from '../../components/content/ContentLibraryNavTabs';
import { PlaylistSections } from '../../components/content/PlaylistSections';
import { PlaylistVideosFlattenGrid } from '../../components/content/PlaylistVideosFlattenGrid';
import { ConversationsHero, ConversationsHeroSkeleton } from '../../components/content/ConversationsHero';
import { ConversationsClipCard } from '../../components/content/ConversationsClipCard';
import { ConversationRow, StripCard, StripRowLoading } from '../../components/home/ConversationRow';
import { BiomarkerConversationRow, BIOMARKER_CAROUSEL_IDS } from '../../components/content/BiomarkerConversationRow';
import {
  filterPlaylistsByFocus,
  parsePlaylistFocus,
  playlistBrowseHeading as playlistBrowseHeadingText,
  PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS,
  VIEW_PLAYLIST_LABEL,
} from '../../utils/playlistFocusFilters';
import { PlaylistFocusNav } from '../../components/content/PlaylistFocusNav';
import { useFlattenedPlaylistVideos } from '../../hooks/useFlattenedPlaylistVideos';
import { APP_CATALOG_CLIPS_GRID, APP_CATALOG_CONVERSATIONS_HUB } from '../../components/navigation/appNavItems';
import { getPublicLibraryViewFromSearch } from '../../utils/catalogBrowseLocation';
import { useWordPressCatalog, WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';

/**
 * Sort options surfaced in the catalog "Sort by" dropdown.
 * - `recorded_at`: orders by shoot date (Shoot.shoot_date with posted_at fallback).
 *   Distinct from `posted` — this is when the content was *recorded*, not when it
 *   was published to social media. Default UX choice for "what's new in the catalog".
 * - `posted`: orders by social-media post date (`posted_at`). Renamed in the UI from
 *   the older "Most recent" / "Recently posted" pair (which were byte-identical at
 *   the backend — see 2026-05-16 audit). The duplicate "Most recent" option has been
 *   removed; legacy `?sort=recent` URLs are redirected to `posted` below.
 * - `views`/`likes`: engagement-driven sorts.
 */
const SORT_OPTIONS = [
  { value: 'recorded_at', label: 'Recently recorded' },
  { value: 'posted', label: 'Recently posted' },
  { value: 'views', label: 'Most watched' },
  { value: 'likes', label: 'Most liked' },
];

/** Valid values for ?sort= / sort_by (MediaHub catalog API). */
const SORT_PARAM_VALUES = new Set(['views', 'likes', 'posted', 'recorded_at']);

/** Default sort the user lands on when no `?sort=` query param is present. */
const DEFAULT_SORT = 'recorded_at';

/**
 * Tag-namespace ordering + display labels for the grouped tag dropdown.
 * Backend `/api/catalog/tags` returns `Record<namespace, string[]>`; we render one
 * `<optgroup>` per namespace in this order. `doctor` is intentionally omitted —
 * the "All doctors" dropdown sitting next to this control already covers it.
 */
const TAG_NAMESPACE_ORDER: { key: string; label: string }[] = [
  { key: 'biomarker', label: 'Biomarkers' },
  { key: 'stage', label: 'Stages' },
  { key: 'drug', label: 'Drugs' },
  { key: 'trial', label: 'Trials' },
  { key: 'topic', label: 'Topics' },
  { key: 'brand', label: 'Brands' },
];

/**
 * Client-side alias map: collapse equivalent tag values to a single canonical form
 * so the dropdown doesn't show both "TNBC" and "Triple Negative" as separate entries.
 * Canonical form picks the compact clinician-friendly code ("TNBC", "eBC", "mBC").
 */
const TAG_ALIASES: Record<string, string> = {
  'Triple Negative': 'TNBC',
  'triple negative': 'TNBC',
  'early breast cancer': 'eBC',
  'Early Breast Cancer': 'eBC',
  'metastatic breast cancer': 'mBC',
  'Metastatic Breast Cancer': 'mBC',
};

function stripNamespacePrefix(value: string): string {
  const idx = value.indexOf(':');
  if (idx === -1) return value;
  return value.slice(idx + 1);
}

function canonicalizeTag(value: string): string {
  return TAG_ALIASES[value] ?? value;
}

function groupTagsByNamespace(
  tags: MediaHubTags,
): { label: string; options: { value: string; label: string }[] }[] {
  const groups: { label: string; options: { value: string; label: string }[] }[] = [];
  for (const { key, label } of TAG_NAMESPACE_ORDER) {
    const raw = tags[key];
    if (!Array.isArray(raw) || raw.length === 0) continue;
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const v of raw) {
      if (!v) continue;
      const stripped = stripNamespacePrefix(String(v));
      const canonical = canonicalizeTag(stripped);
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      opts.push({ value: canonical, label: canonical });
    }
    opts.sort((a, b) => a.label.localeCompare(b.label));
    if (opts.length > 0) groups.push({ label, options: opts });
  }
  return groups;
}

function getDoctorOptions(doctors: { slug: string }[]): { value: string; label: string }[] {
  return doctors.map((d) => ({ value: d.slug, label: doctorLabelFromSlug(d.slug) }));
}

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

type ClipsPage = Awaited<ReturnType<typeof catalogApi.getClips>>;
type SortByParam = 'views' | 'likes' | 'posted' | 'recorded_at';

export default function VideosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isInApp = location.pathname.startsWith('/app');
  const basePath = isInApp ? '/app' : '';
  const wpMode = useWordPressCatalog();
  /** Server already filters with has_wordpress=true; do not require inline wordpress blob yet. */
  const clipSurfaceOpts = undefined;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>(DEFAULT_SORT);
  const [sortOpen, setSortOpen] = useState(false);

  // Ref so the filter-sync effect can read the current location without being
  // retriggered by navigation (which caused the playlists ↔ catalog ping-pong).
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  });

  const effectiveLibraryView: 'clips' | 'playlists' = useMemo(() => {
    if (isInApp) return new URLSearchParams(location.search).get('view') === 'playlists' ? 'playlists' : 'clips';
    return getPublicLibraryViewFromSearch(location.search || '');
  }, [isInApp, location.search]);

  // Apply URL → state (shared for /catalog and /app/catalog).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qRaw = params.get('q') ?? '';
    setQuery(qRaw);
    setDebouncedQuery(qRaw.trim());
    setTagFilter(params.get('tag') ?? '');
    setDoctorFilter(params.get('doctor') ?? '');
    const sortRaw = params.get('sort') ?? params.get('sort_by') ?? '';
    // Back-compat: legacy `?sort=recent` was byte-identical to `?sort=posted` at
    // the backend (2026-05-16 audit). Redirect old links to `posted`.
    const sortNormalized = sortRaw === 'recent' ? 'posted' : sortRaw;
    setSortBy(SORT_PARAM_VALUES.has(sortNormalized) ? sortNormalized : DEFAULT_SORT);
  }, [location.search, isInApp]);

  useLayoutEffect(() => {
    const qs = location.search ?? '';
    const p = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
    if (p.get('view') !== 'playlists') return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Keep query string in sync with filter state only. Reads location via ref so
  // that tab navigation (which changes location.search) does NOT retrigger this
  // effect — preventing the playlists ↔ catalog ping-pong caused by stale filter
  // state being seen after a navigation but before the URL→state effect resets it.
  useEffect(() => {
    const loc = locationRef.current;
    const liveParams = new URLSearchParams(location.search.replace(/^\?/, ''));
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set('q', q);
    if (tagFilter) params.set('tag', tagFilter);
    if (doctorFilter) params.set('doctor', doctorFilter);
    // Only emit `?sort=` when it differs from the default — keeps URLs clean.
    if (sortBy && sortBy !== DEFAULT_SORT) params.set('sort', sortBy);

    const curParams = new URLSearchParams((loc.search || '').replace(/^\?/, ''));

    if (!isInApp) {
      // Always preserve the view already in the URL. Tab clicks own the view;
      // this effect only owns the filter params.
      const pv = curParams.get('view');
      const view: 'clips' | 'playlists' = pv === 'playlists' ? 'playlists' : 'clips';
      params.set('view', view);
      if (view === 'playlists') {
        const pf = parsePlaylistFocus('?' + curParams.toString());
        if (pf) params.set('playlistFocus', pf);
      }
    } else if (isInApp) {
      // Use live URL for view= so typing search never drops ?view=clips (locationRef can lag).
      const pv = liveParams.get('view') ?? curParams.get('view');
      const filterActive =
        !!q || !!tagFilter || !!doctorFilter || (sortBy && sortBy !== DEFAULT_SORT);
      if (pv === 'playlists') {
        params.set('view', 'playlists');
        const pfSource = liveParams.toString() || curParams.toString();
        const pfApp = parsePlaylistFocus('?' + pfSource);
        if (pfApp) params.set('playlistFocus', pfApp);
      } else if (pv === 'clips' || filterActive) {
        params.set('view', 'clips');
      }
    }

    const next = params.toString();
    const cur = location.search.replace(/^\?/, '');
    if (next === cur) return;
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, tagFilter, doctorFilter, sortBy, isInApp, navigate, location.search]);
  const { data: tags = {}, isSuccess: tagsReady } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
    enabled: !wpMode,
  });

  const { data: doctors = [], isSuccess: doctorsReady } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: catalogApi.getDoctors,
    staleTime: 10 * 60 * 1000,
    enabled: !wpMode,
  });

  const tagGroups = useMemo(() => groupTagsByNamespace(tags), [tags]);
  const doctorOptions = useMemo(() => getDoctorOptions(doctors), [doctors]);
  /** WordPress catalog: clips load without waiting on MediaHub tags/doctors. */
  const useMediaHub = wpMode || (tagsReady && doctorsReady);

  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 10 * 60 * 1000,
  });

  const playlistFocus = useMemo(() => parsePlaylistFocus(location.search || ''), [location.search]);

  const playlistsForPlaylistView = useMemo(() => {
    if (effectiveLibraryView !== 'playlists') return playlists;
    if (!playlistFocus) return playlists;
    return filterPlaylistsByFocus(playlists, playlistFocus);
  }, [playlists, effectiveLibraryView, playlistFocus]);

  const focusPlaylistIds = useMemo(
    () => playlistsForPlaylistView.map((p) => p.id),
    [playlistsForPlaylistView],
  );

  const focusPlaylistVideosFetch = useFlattenedPlaylistVideos(
    focusPlaylistIds,
    !!(playlistFocus && effectiveLibraryView === 'playlists' && focusPlaylistIds.length > 0),
  );

  const {
    data: rawClipsData,
    isLoading: clipsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    ClipsPage,
    Error,
    InfiniteData<ClipsPage, number>,
    readonly [string, string, string, string, string, string],
    number
  >({
    queryKey: ['catalog', 'clips', debouncedQuery, tagFilter, doctorFilter, sortBy, wpMode ? 'wp' : 'legacy'],
    queryFn: ({ pageParam = 0 }) =>
      catalogApi.getClips({
        q: debouncedQuery || undefined,
        tag: tagFilter || undefined,
        doctor: doctorFilter || undefined,
        sort_by: sortBy ? (sortBy as SortByParam) : undefined,
        limit: CLIPS_PAGE_SIZE,
        offset: pageParam,
        ...(wpMode ? { has_wordpress: true } : {}),
      }),
    getNextPageParam: (lastPage, allPages) => {
      const lastItems = lastPage?.items ?? [];
      // Full page ⇒ assume more exist. Do not trust `total` when it equals
      // the page size (ContentHub currently returns total === items.length).
      if (lastItems.length < CLIPS_PAGE_SIZE) return undefined;
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0);
      const total = lastPage?.total ?? 0;
      if (total > CLIPS_PAGE_SIZE && loaded >= total) return undefined;
      return loaded;
    },
    initialPageParam: 0,
    enabled: useMediaHub && effectiveLibraryView === 'clips',
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });

  const clipsData: InfiniteData<ClipsPage, number> | undefined =
    rawClipsData as unknown as InfiniteData<ClipsPage, number> | undefined;
  const clipsPageCount = clipsData?.pages.length ?? 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);

  // In-app full library grid only at ?view=clips (“See all in library”). Default /app/catalog = strip home.
  const showClipsGrid =
    isInApp && new URLSearchParams(location.search).get('view') === 'clips';

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (
        target?.isIntersecting &&
        hasNextPage &&
        !isFetchingNextPage &&
        !clipsLoading &&
        clipsPageCount > 0
      ) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage, clipsLoading, clipsPageCount],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const clipsPagerActive =
      effectiveLibraryView === 'clips' && (!isInApp || showClipsGrid);
    // Wait until the first page is on screen before observing, so an empty
    // first paint can't chain-load every offset.
    if (!clipsPagerActive || clipsLoading || clipsPageCount === 0) return;
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: '200px',
      threshold: 0,
    });
    // Defer observe one frame so the sentinel isn't treated as "already
    // intersecting" during the initial layout of page 1.
    const raf = requestAnimationFrame(() => observer.observe(el));
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [effectiveLibraryView, handleObserver, isInApp, showClipsGrid, clipsLoading, clipsPageCount]);

  const mediaHubItems = useMemo(
    () =>
      (clipsData?.pages?.flatMap((p) => p?.items ?? []) ?? []).filter((c) =>
        shouldSurfaceCatalogClip(c, clipSurfaceOpts),
      ),
    [clipsData?.pages],
  );

  const displayItems = useMediaHub ? mediaHubItems : [];
  const isLoading = useMediaHub ? clipsLoading : false;

  const firstPageItems = (clipsData?.pages?.[0]?.items ?? []).filter((c) =>
    shouldSurfaceCatalogClip(c, clipSurfaceOpts),
  );
  const featuredClip = firstPageItems[0] ?? null;
  const gridItems = useMemo(
    () => (featuredClip ? displayItems.filter((c) => c.id !== featuredClip.id) : displayItems),
    [displayItems, featuredClip],
  );

  const isInitialClipsLoad =
    useMediaHub && effectiveLibraryView === 'clips' && clipsLoading && clipsPageCount === 0;
  const newestItems = useMemo(() => gridItems.slice(0, 14), [gridItems]);
  const filterOrSortActive = !!(
    debouncedQuery.trim() || tagFilter || doctorFilter || (sortBy && sortBy !== DEFAULT_SORT)
  );

  const playlistDescription = (p: (typeof playlists)[0]) =>
    p.videoNames?.slice(0, 3).join(' • ') || `${p.videoCount} video${p.videoCount !== 1 ? 's' : ''}`;

  const playlistsCarouselStrip =
    playlists.length > 0 ? (
      <section className="space-y-0">
        <ConversationRow
          title="Playlists"
          subtitle={`${playlists.length} curated ${playlists.length === 1 ? 'list' : 'lists'}`}
          seeAllHref={isInApp ? '/app/catalog?view=playlists' : '/catalog?view=playlists'}
          seeAllLabel="See all playlists"
        >
          {playlists.slice(0, 12).map((p) => (
            <StripCard
              key={p.id}
              to={isInApp ? `/app/catalog/playlist/${p.id}` : `/catalog/playlist/${p.id}`}
              title={p.title}
              imageUrl={p.thumbnailUrl || 'https://via.placeholder.com/400x260?text=Playlist'}
              description={playlistDescription(p)}
              videoLabel={
                p.videoCount != null && p.videoCount > 0
                  ? `${p.videoCount.toLocaleString()} video${p.videoCount !== 1 ? 's' : ''}`
                  : p.videoNames && p.videoNames.length > 0
                    ? `${p.videoNames.length} video${p.videoNames.length !== 1 ? 's' : ''}`
                    : undefined
              }
            />
          ))}
        </ConversationRow>
      </section>
    ) : null;

  return (
    <div className="min-h-screen min-w-0 bg-transparent">
      <div
        className={[
          isInApp && !showClipsGrid
            ? 'w-full px-0 py-0 space-y-8 md:space-y-10'
            : 'mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8',
        ].join(' ')}
      >
        {effectiveLibraryView === 'clips' && !isInApp ? (
          <div className="flex items-center gap-2.5 pt-2 text-zinc-900 sm:pt-4">
            <MonitorPlay className="h-5 w-5 shrink-0 text-steel-700 dark:text-steel-400" strokeWidth={2} aria-hidden />
            <h1 className="text-left text-balance text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
              Explore our catalogue
            </h1>
          </div>
        ) : null}

        {effectiveLibraryView === 'clips' && !isInApp ? (
          <ContentLibraryNavTabs isInApp={isInApp} />
        ) : null}

        {effectiveLibraryView === 'clips' && useMediaHub && (!isInApp || showClipsGrid) && (
          <section className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {!wpMode ? (
              <>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="min-w-[160px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                >
                  <option value="">All tags</option>
                  {tagGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={`${group.label}:${opt.value}`} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                  className="min-w-[160px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
                >
                  <option value="">All doctors</option>
                  {doctorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="inline-flex min-w-[140px] items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900"
              >
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort by'}
                <ChevronDown className={`h-4 w-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                          sortBy === opt.value ? 'bg-gray-50 font-medium text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {effectiveLibraryView === 'clips' && useMediaHub && isInitialClipsLoad && isInApp && !showClipsGrid && (
          <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
            <ConversationsHeroSkeleton />
          </section>
        )}

        {effectiveLibraryView === 'clips' && useMediaHub && !isInitialClipsLoad && featuredClip && isInApp && !showClipsGrid && (
          <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
            <ConversationsHero clip={featuredClip} isInApp={isInApp} />
          </section>
        )}


        {effectiveLibraryView === 'playlists' ? (
            <section className={[isInApp ? 'px-4 sm:px-6 lg:px-8' : '', 'space-y-4'].filter(Boolean).join(' ')}>
              <PlaylistFocusNav
                isInApp={isInApp}
                allowedPlaylistFocusFilters={isInApp ? undefined : PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS}
              />
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-zinc-100">
                    {playlistBrowseHeadingText(playlistFocus)}
                  </h2>
                  {playlistFocus ? (
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      {focusPlaylistVideosFetch.isLoading
                        ? 'Loading videos…'
                        : focusPlaylistVideosFetch.entries.length > 0
                          ? `${focusPlaylistVideosFetch.entries.length} videos from ${playlistsForPlaylistView.length} playlist${
                              playlistsForPlaylistView.length !== 1 ? 's' : ''
                            }`
                          : playlistsForPlaylistView.length === 0
                            ? ''
                            : 'Videos from playlists in this category'}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-zinc-400">
                      Browse KOL playlists and ASCO 2026 series
                    </p>
                  )}
                </div>
                {!isInApp ? (
                  <Link
                    to="/catalog?view=clips"
                    className="shrink-0 text-sm font-semibold text-steel-600 transition-colors hover:text-steel-800 hover:underline dark:text-steel-400 dark:hover:text-steel-300"
                  >
                    Browse conversations
                  </Link>
                ) : null}
              </div>
            {playlistFocus ? (
              focusPlaylistVideosFetch.isLoading ? (
                <div className="flex justify-center py-16" aria-busy="true">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : focusPlaylistVideosFetch.isError ? (
                <p className="text-sm text-red-600">Could not load playlist videos. Try again later.</p>
              ) : focusPlaylistVideosFetch.entries.length > 0 ? (
                <PlaylistVideosFlattenGrid
                  entries={focusPlaylistVideosFetch.entries}
                  isInApp={isInApp}
                  showPlaylistTitles
                />
              ) : playlistsForPlaylistView.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-zinc-400">No playlists match this category yet.</p>
              ) : (
                <p className="text-sm text-gray-600 dark:text-zinc-400">No videos found in these playlists.</p>
              )
            ) : (
              <>
                <PlaylistSections playlists={playlistsForPlaylistView} isInApp={isInApp} />
                {playlists.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-zinc-400">
                    No playlists configured. Add YouTube playlist IDs on the server.
                  </p>
                ) : null}
              </>
            )}
          </section>
        ) : isInApp && showClipsGrid ? (
          // /app/catalog?view=clips — full searchable grid, same layout as public /catalog?view=clips
          <section className="space-y-4">
            <h2 className="sr-only">Video library</h2>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {!useMediaHub ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-2 text-pretty text-gray-600">Video catalog is not connected.</p>
                </div>
              ) : useMediaHub && isLoading && displayItems.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : useMediaHub && displayItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-2 text-pretty text-gray-600">No results match.</p>
                  <p className="text-pretty text-sm text-gray-500">Change search or filters and try again.</p>
                </div>
              ) : (
                displayItems.map((item) => (
                  <ConversationsClipCard
                    key={item.id}
                    item={item}
                    href={`/app/clip/${getShortClipId(item.id)}`}
                  />
                ))
              )}
            </div>
            {useMediaHub && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-gray-400" />}
              </div>
            )}
          </section>
        ) : isInApp ? (
          // /app/catalog (default) — strip rows with hero + biomarker sections
          <section className="space-y-10">
            {!useMediaHub && playlists.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-2 text-pretty text-gray-600">Video catalog needs a MediaHub API key or playlists.</p>
                <p className="mb-3 text-pretty text-sm text-gray-500">Set mediahub_api_key or youtube_playlist_ids in the backend.</p>
                <Link
                  to={APP_CATALOG_CLIPS_GRID}
                  className="text-sm font-medium text-gray-900 transition-[color,transform] duration-200 ease-out hover:underline active:scale-[0.98]"
                >
                  Browse catalog
                </Link>
              </div>
            ) : !useMediaHub && playlists.length > 0 ? (
              <>
                {playlistsCarouselStrip}
                <div className="col-span-full flex flex-col items-center justify-center space-y-4 py-8 text-center">
                  <p className="text-pretty text-gray-600">
                    MediaHub is not connected. Add API keys in the server to load the featured banner and conversation rows.
                  </p>
                </div>
              </>
            ) : useMediaHub && isLoading && displayItems.length === 0 ? (
              <>
                <ConversationRow title="Loading conversations" seeAllHref={APP_CATALOG_CLIPS_GRID}>
                  <StripRowLoading />
                </ConversationRow>
                <ConversationRow title="Browse by series" seeAllHref={APP_CATALOG_CLIPS_GRID}>
                  <StripRowLoading />
                </ConversationRow>
                {playlistsCarouselStrip}
              </>
            ) : useMediaHub && displayItems.length === 0 ? (
              <>
                {playlistsCarouselStrip}
                <div className="col-span-full flex flex-col items-center justify-center py-10 text-center">
                  <p className="mb-2 text-pretty text-gray-600">No results match.</p>
                  <p className="text-pretty text-sm text-gray-500">Change search or filters and try again.</p>
                </div>
                {BIOMARKER_CAROUSEL_IDS.map((id) => (
                  <BiomarkerConversationRow key={id} carouselId={id} isInApp={true} />
                ))}
              </>
            ) : (
              <>
                {newestItems.length > 0 ? (
                  <ConversationRow
                    title={filterOrSortActive ? 'Matching videos' : 'Recently added'}
                    subtitle={`${newestItems.length} videos`}
                    seeAllHref={APP_CATALOG_CLIPS_GRID}
                  >
                    {newestItems.map((item) => (
                      <StripCard
                        key={`new-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        description={clipStripeSubtitle(item) || 'Conversation'}
                      />
                    ))}
                  </ConversationRow>
                ) : null}
                {playlistsCarouselStrip}
                {BIOMARKER_CAROUSEL_IDS.map((id) => (
                  <BiomarkerConversationRow key={id} carouselId={id} isInApp={true} />
                ))}
              </>
            )}
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="sr-only">Video library</h2>
            <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {!useMediaHub && playlists.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-2 text-pretty text-gray-600">Video catalog needs a MediaHub API key or playlists.</p>
                  <p className="mb-3 text-pretty text-sm text-gray-500">Set mediahub_api_key or youtube_playlist_ids in the backend.</p>
                  <Link
                    to={'/catalog?view=clips'}
                    className="text-sm font-medium text-gray-900 transition-[color,transform] duration-200 ease-out hover:underline active:scale-[0.98]"
                  >
                    Browse catalog
                  </Link>
                </div>
              ) : !useMediaHub && playlists.length > 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center space-y-4 py-8 text-center">
                  <p className="text-pretty text-gray-600">
                    MediaHub is not connected. Add API keys in the server to load the featured banner and conversation grid.
                  </p>
                  <Link
                    to={'/catalog?view=clips'}
                    className="text-sm font-medium text-gray-900 transition-[color,transform] duration-200 ease-out hover:underline active:scale-[0.98]"
                  >
                    Open catalog
                  </Link>
                </div>
              ) : useMediaHub && isLoading && displayItems.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : useMediaHub && displayItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="mb-2 text-pretty text-gray-600">No results match.</p>
                  <p className="text-pretty text-sm text-gray-500">Change search or filters and try again.</p>
                </div>
              ) : (
                displayItems.map((item) => {
                  const detailUrl = isInApp
                    ? `/app/clip/${getShortClipId(item.id)}`
                    : `/catalog/clip/${getShortClipId(item.id)}`;
                  return <ConversationsClipCard key={item.id} item={item} href={detailUrl} />;
                })
              )}
            </div>
            {useMediaHub && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-gray-400" />}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
