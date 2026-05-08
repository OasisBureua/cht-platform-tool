import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { Search, Loader2, ChevronDown, MonitorPlay } from 'lucide-react';
import { catalogApi, type MediaHubTags } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail, hasRealThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { ContentLibraryNavTabs } from '../../components/content/ContentLibraryNavTabs';
import { PlaylistGrid } from '../../components/content/PlaylistGrid';
import { PlaylistVideosFlattenGrid } from '../../components/content/PlaylistVideosFlattenGrid';
import { ConversationsHero, ConversationsHeroSkeleton } from '../../components/content/ConversationsHero';
import { ConversationsClipCard } from '../../components/content/ConversationsClipCard';
import { ConversationRow, StripCard, StripRowLoading } from '../../components/home/ConversationRow';
import { BiomarkerConversationRow, BIOMARKER_ROWS } from '../../components/content/BiomarkerConversationRow';
import {
  filterPlaylistsByFocus,
  parsePlaylistFocus,
  playlistBrowseHeading as playlistBrowseHeadingText,
  PUBLIC_CATALOG_PLAYLIST_NAV_FOCUS,
  VIEW_PLAYLIST_LABEL,
} from '../../utils/playlistFocusFilters';
import { PlaylistFocusNav } from '../../components/content/PlaylistFocusNav';
import { useFlattenedPlaylistVideos } from '../../hooks/useFlattenedPlaylistVideos';

const SORT_OPTIONS = [
  { value: '', label: 'Sort by' },
  { value: 'recent', label: 'Most recent' },
  { value: 'posted', label: 'Recently posted' },
  { value: 'views', label: 'Most views' },
  { value: 'likes', label: 'Most likes' },
];

function flattenTags(tags: MediaHubTags): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const [, values] of Object.entries(tags)) {
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push({ value: v, label: v });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

function getDoctorOptions(doctors: { slug: string }[]): { value: string; label: string }[] {
  return doctors.map((d) => ({ value: d.slug, label: doctorLabelFromSlug(d.slug) }));
}

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

type ClipsPage = Awaited<ReturnType<typeof catalogApi.getClips>>;

/** Valid values for ?sort= / sort_by (MediaHub catalog API). */
const SORT_PARAM_VALUES = new Set(['views', 'likes', 'recent', 'posted']);

/** Public /catalog `?view=` clips vs playlists — same rules as ContentLibraryNavTabs. */
function getPublicLibraryViewFromSearch(search: string): 'clips' | 'playlists' {
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

export default function VideosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const isInApp = location.pathname.startsWith('/app');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

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
    const sort = params.get('sort') ?? params.get('sort_by') ?? '';
    setSortBy(SORT_PARAM_VALUES.has(sort) ? sort : '');
  }, [location.search, isInApp]);

/** Landing from focussed playlist/browse deep links (`?view=playlists`) — scroll to top. */
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

  // Keep query string in sync with filters (search text uses live `query` so deep links with ?q= aren’t wiped before debounce).
  useEffect(() => {
    const params = new URLSearchParams();
    const q = query.trim();
    if (q) params.set('q', q);
    if (tagFilter) params.set('tag', tagFilter);
    if (doctorFilter) params.set('doctor', doctorFilter);
    if (sortBy) params.set('sort', sortBy);

    const curParams = new URLSearchParams((location.search || '').replace(/^\?/, ''));
    const hasFilters = !!(q || tagFilter || doctorFilter || sortBy);

    if (!isInApp) {
      let view: 'clips' | 'playlists';
      if (hasFilters) view = 'clips';
      else {
        const pv = curParams.get('view');
        if (pv === 'clips' || pv === 'playlists') view = pv === 'playlists' ? 'playlists' : 'clips';
        else view = 'playlists';
      }
      params.set('view', view);
      if (view === 'playlists') {
        const pf = parsePlaylistFocus('?' + curParams.toString());
        if (pf) params.set('playlistFocus', pf);
      }
    } else if (curParams.get('view') === 'playlists') {
      params.set('view', 'playlists');
      const pfApp = parsePlaylistFocus('?' + curParams.toString());
      if (pfApp) params.set('playlistFocus', pfApp);
    }

    const next = params.toString();
    const cur = (location.search || '').replace(/^\?/, '');
    if (next === cur) return;
    navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
  }, [
    query,
    tagFilter,
    doctorFilter,
    sortBy,
    isInApp,
    location.pathname,
    location.search,
    navigate,
  ]);

  const { data: tags = {}, isSuccess: tagsReady } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });

  const { data: doctors = [], isSuccess: doctorsReady } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: catalogApi.getDoctors,
    staleTime: 10 * 60 * 1000,
  });

  const tagOptions = useMemo(() => flattenTags(tags), [tags]);
  const doctorOptions = useMemo(() => getDoctorOptions(doctors), [doctors]);
  /** Clips/filters load once tags + doctors requests finish — do not block on empty tag list (MediaHub can return {}). */
  const useMediaHub = tagsReady && doctorsReady;

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
    queryKey: ['catalog', 'clips', debouncedQuery, tagFilter, doctorFilter, sortBy],
    queryFn: ({ pageParam = 0 }) =>
      catalogApi.getClips({
        q: debouncedQuery || undefined,
        tag: tagFilter || undefined,
        doctor: doctorFilter || undefined,
        sort_by: sortBy ? (sortBy as 'views' | 'likes' | 'recent' | 'posted') : undefined,
        limit: CLIPS_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const lastItems = lastPage?.items ?? [];
      const loaded = allPages.reduce((acc, p) => acc + (p?.items?.length ?? 0), 0);
      return lastItems.length === CLIPS_PAGE_SIZE ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: useMediaHub && effectiveLibraryView === 'clips',
    staleTime: 2 * 60 * 1000,
  });

  const clipsData: InfiniteData<ClipsPage, number> | undefined =
    rawClipsData as unknown as InfiniteData<ClipsPage, number> | undefined;
  const clipsPageCount = clipsData?.pages.length ?? 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [target] = entries;
      if (target?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleObserver, { rootMargin: '200px', threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleObserver]);

  const mediaHubItems = useMemo(
    () => (clipsData?.pages?.flatMap((p) => p?.items ?? []) ?? []).filter(hasRealThumbnail),
    [clipsData?.pages],
  );

  const displayItems = useMediaHub ? mediaHubItems : [];
  const isLoading = useMediaHub ? clipsLoading : false;

  const firstPageItems = (clipsData?.pages?.[0]?.items ?? []).filter(hasRealThumbnail);
  const featuredClip = firstPageItems[0] ?? null;
  const gridItems = useMemo(
    () => (featuredClip ? displayItems.filter((c) => c.id !== featuredClip.id) : displayItems),
    [displayItems, featuredClip],
  );

  const isInitialClipsLoad =
    useMediaHub && effectiveLibraryView === 'clips' && clipsLoading && clipsPageCount === 0;
  const newestItems = useMemo(() => gridItems.slice(0, 14), [gridItems]);
  const filterOrSortActive = !!(debouncedQuery.trim() || tagFilter || doctorFilter || sortBy);

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
          isInApp
            ? 'w-full px-0 py-0 space-y-8 md:space-y-10'
            : 'mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8',
        ].join(' ')}
      >
        {!isInApp && effectiveLibraryView === 'clips' ? (
          <div className="flex items-center gap-2.5 pt-6 text-zinc-900 sm:pt-8">
            <MonitorPlay className="h-5 w-5 shrink-0 text-brand-700" strokeWidth={2} aria-hidden />
            <h1 className="text-left text-balance text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
              Explore our catalogue
            </h1>
          </div>
        ) : null}

        {!isInApp && effectiveLibraryView === 'clips' ? (
          <ContentLibraryNavTabs isInApp={false} />
        ) : null}

        {effectiveLibraryView === 'clips' && useMediaHub && !isInApp && (
          <section
            className={[
              'flex flex-col gap-3 md:flex-row md:flex-wrap',
              isInApp ? 'px-4 sm:px-6 lg:px-8' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 min-w-[160px]"
            >
              <option value="">All tags</option>
              {tagOptions.slice(0, 100).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 min-w-[160px]"
            >
              <option value="">All doctors</option>
              {doctorOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen(!sortOpen)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 inline-flex items-center gap-2 min-w-[140px] justify-between"
              >
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort by'}
                <ChevronDown className={`h-4 w-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
              </button>
              {sortOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} aria-hidden />
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-gray-200 bg-white py-1 shadow-lg min-w-[160px]">
                    {SORT_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortOpen(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                          sortBy === opt.value ? 'font-medium text-gray-900 bg-gray-50' : 'text-gray-600'
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

        {effectiveLibraryView === 'clips' && useMediaHub && isInitialClipsLoad && (
          isInApp ? (
            <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
              <ConversationsHeroSkeleton />
            </section>
          ) : (
            <ConversationsHeroSkeleton />
          )
        )}

        {effectiveLibraryView === 'clips' && useMediaHub && !isInitialClipsLoad && featuredClip && (
          isInApp ? (
            <section className="-mx-4 -mt-6 sm:-mx-6 sm:-mt-8 lg:-mx-8 lg:-mt-8">
              <ConversationsHero clip={featuredClip} isInApp={isInApp} />
            </section>
          ) : (
            <ConversationsHero clip={featuredClip} isInApp={isInApp} />
          )
        )}

        {!isInApp && effectiveLibraryView === 'clips' && useMediaHub && !isInitialClipsLoad && (
          <section className="mx-auto max-w-7xl space-y-10 px-3 sm:px-6 pb-2 sm:pb-6">
            {playlistsCarouselStrip}
            {BIOMARKER_ROWS.map((row) => (
              <BiomarkerConversationRow key={row.focus} label={row.label} focus={row.focus} isInApp={false} />
            ))}
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
                    <p className="text-sm text-gray-600 dark:text-zinc-400">Curated YouTube playlists</p>
                  )}
                </div>
                {!isInApp ? (
                  <Link
                    to="/catalog?view=clips"
                    className="shrink-0 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-800 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
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
                <PlaylistGrid playlists={playlistsForPlaylistView} isInApp={isInApp} descriptionForItem={playlistDescription} />
                {playlists.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-zinc-400">
                    No playlists configured. Add YouTube playlist IDs on the server.
                  </p>
                ) : null}
              </>
            )}
          </section>
        ) : isInApp ? (
          <section className="space-y-10">
            {!useMediaHub && playlists.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-2 text-pretty text-gray-600">Video catalog needs a MediaHub API key or playlists.</p>
                <p className="mb-3 text-pretty text-sm text-gray-500">Set mediahub_api_key or youtube_playlist_ids in the backend.</p>
                <Link
                  to="/app/catalog"
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
                <ConversationRow title="Loading conversations" seeAllHref="/app/catalog">
                  <StripRowLoading />
                </ConversationRow>
                <ConversationRow title="Browse by series" seeAllHref="/app/catalog">
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
                {BIOMARKER_ROWS.map((row) => (
                  <BiomarkerConversationRow key={row.focus} label={row.label} focus={row.focus} isInApp={true} />
                ))}
              </>
            ) : (
              <>
                {newestItems.length > 0 ? (
                  <ConversationRow
                    title={filterOrSortActive ? 'Matching videos' : 'Recently added'}
                    subtitle={`${newestItems.length} videos`}
                    seeAllHref="/app/catalog"
                  >
                    {newestItems.map((item) => (
                      <StripCard
                        key={`new-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        description={clipDisplaySummary(item) || item.doctors?.[0] || 'Conversation'}
                      />
                    ))}
                  </ConversationRow>
                ) : null}
                {playlistsCarouselStrip}
                {BIOMARKER_ROWS.map((row) => (
                  <BiomarkerConversationRow key={row.focus} label={row.label} focus={row.focus} isInApp={true} />
                ))}
              </>
            )}
            {useMediaHub && (
              <div ref={loadMoreRef} className="flex justify-center py-2">
                {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-gray-400" />}
              </div>
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
                    to={isInApp ? '/app/catalog' : '/catalog'}
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
                    to={isInApp ? '/app/catalog' : '/catalog'}
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
              ) : useMediaHub && gridItems.length === 0 && displayItems.length > 0 ? (
                <p className="col-span-full text-pretty text-center text-sm text-zinc-500">
                  That is the only clip for this search.
                </p>
              ) : (
                gridItems.map((item) => {
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
