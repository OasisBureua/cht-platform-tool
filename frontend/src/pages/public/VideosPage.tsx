import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { Search, Loader2, ChevronDown, MonitorPlay } from 'lucide-react';
import { catalogApi, type MediaHubTags } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';
import { ContentLibraryNavTabs } from '../../components/content/ContentLibraryNavTabs';
import { PlaylistGrid } from '../../components/content/PlaylistGrid';
import { ConversationsHero, ConversationsHeroSkeleton } from '../../components/content/ConversationsHero';
import { ConversationsClipCard } from '../../components/content/ConversationsClipCard';
import { ConversationRow, StripCard, StripRowLoading } from '../../components/home/ConversationRow';

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

export default function VideosPage() {
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const [libraryView, setLibraryView] = useState<'clips' | 'playlists'>('clips');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

  // Use location.search so /catalog and /app/catalog behave the same under nested <Outlet /> (avoids useSearchParams edge cases).
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    if (q != null && q !== '') setQuery(q);
    const tag = params.get('tag');
    if (tag != null && tag !== '') setTagFilter(tag);
    const view = params.get('view');
    if (view === 'playlists') setLibraryView('playlists');
  }, [location.search]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const { data: tags = {} } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ['catalog', 'doctors'],
    queryFn: catalogApi.getDoctors,
    staleTime: 10 * 60 * 1000,
  });

  const tagOptions = useMemo(() => flattenTags(tags), [tags]);
  const doctorOptions = useMemo(() => getDoctorOptions(doctors), [doctors]);
  const useMediaHub = tagOptions.length > 0;
  const effectiveLibraryView: 'clips' | 'playlists' = isInApp ? 'clips' : libraryView;

  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 10 * 60 * 1000,
  });

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
    () => clipsData?.pages?.flatMap((p) => p?.items ?? []) ?? [],
    [clipsData?.pages],
  );

  const displayItems = useMediaHub ? mediaHubItems : [];
  const isLoading = useMediaHub ? clipsLoading : false;

  const firstPageItems = clipsData?.pages?.[0]?.items ?? [];
  const featuredClip = firstPageItems[0] ?? null;
  const gridItems = useMemo(
    () => (featuredClip ? displayItems.filter((c) => c.id !== featuredClip.id) : displayItems),
    [displayItems, featuredClip],
  );

  const isInitialClipsLoad =
    useMediaHub && effectiveLibraryView === 'clips' && clipsLoading && clipsPageCount === 0;
  const newestItems = useMemo(() => gridItems.slice(0, 14), [gridItems]);
  const popularItems = useMemo(
    () =>
      [...gridItems]
        .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
        .slice(0, 14),
    [gridItems],
  );
  const shortItems = useMemo(
    () =>
      gridItems
        .filter((c) => c.is_short)
        .slice(0, 14),
    [gridItems],
  );

  const playlistDescription = (p: (typeof playlists)[0]) =>
    p.videoNames?.slice(0, 3).join(' • ') || `${p.videoCount} video${p.videoCount !== 1 ? 's' : ''}`;

  return (
    <div className="min-h-screen min-w-0 bg-transparent">
      <div
        className={[
          isInApp
            ? 'w-full px-0 py-0 sm:py-0 space-y-6 sm:space-y-8'
            : 'mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5 px-4 pt-6 text-zinc-900 sm:px-6 sm:pt-8 lg:px-8">
          <MonitorPlay className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
          <h1 className="text-left text-balance text-2xl font-bold tracking-tight text-zinc-900 md:text-3xl">
            {isInApp ? 'Explore our conversations' : 'Explore our catalogue'}
          </h1>
        </div>

        {!isInApp ? (
          <ContentLibraryNavTabs
            isInApp={isInApp}
            libraryView={libraryView}
            playlistsAvailable={playlists.length > 0}
            onSelectClips={() => setLibraryView('clips')}
            onSelectPlaylists={() => setLibraryView('playlists')}
          />
        ) : null}

        {!isInApp && effectiveLibraryView === 'clips' && useMediaHub && (
          <section className="flex flex-col gap-3 md:flex-row md:flex-wrap">
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
          <div className={isInApp ? '-mx-4 sm:-mx-6 lg:-mx-8' : ''}>
            <ConversationsHeroSkeleton />
          </div>
        )}

        {effectiveLibraryView === 'clips' && useMediaHub && !isInitialClipsLoad && featuredClip && (
          <div className={isInApp ? '-mx-4 sm:-mx-6 lg:-mx-8' : ''}>
            <ConversationsHero clip={featuredClip} isInApp={isInApp} />
          </div>
        )}

        {effectiveLibraryView === 'playlists' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">YouTube playlists</h2>
            <PlaylistGrid playlists={playlists} isInApp={isInApp} descriptionForItem={playlistDescription} />
            {playlists.length === 0 ? (
              <p className="text-sm text-gray-600">No playlists configured. Add YouTube playlist IDs on the server.</p>
            ) : null}
          </section>
        ) : isInApp ? (
          <section className="space-y-8">
            {!useMediaHub && playlists.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-2 text-pretty text-gray-600">Video catalog needs a MediaHub API key or YouTube playlists.</p>
                <p className="mb-3 text-pretty text-sm text-gray-500">Set mediahub_api_key or youtube_playlist_ids in the backend.</p>
                <Link
                  to="/app/catalog"
                  className="text-sm font-medium text-gray-900 transition-[color,transform] duration-200 ease-out hover:underline active:scale-[0.98]"
                >
                  Browse catalog
                </Link>
              </div>
            ) : !useMediaHub && playlists.length > 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <p className="text-pretty text-gray-600">
                  MediaHub is not connected. Add API keys in the server to load the featured banner and conversation rows.
                </p>
              </div>
            ) : useMediaHub && isLoading && displayItems.length === 0 ? (
              <>
                <ConversationRow title="Loading conversations" seeAllHref="/app/catalog">
                  <StripRowLoading />
                </ConversationRow>
                <ConversationRow title="Loading popular conversations" seeAllHref="/app/catalog">
                  <StripRowLoading />
                </ConversationRow>
              </>
            ) : useMediaHub && displayItems.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-2 text-pretty text-gray-600">No results match.</p>
                <p className="text-pretty text-sm text-gray-500">Change search or filters and try again.</p>
              </div>
            ) : (
              <>
                {newestItems.length > 0 ? (
                  <ConversationRow
                    title="Recently added"
                    subtitle={`${newestItems.length} videos`}
                    seeAllHref="/app/catalog"
                  >
                    {newestItems.map((item) => (
                      <StripCard
                        key={`new-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        meta={clipDisplaySummary(item) || item.doctors?.[0] || 'Conversation'}
                      />
                    ))}
                  </ConversationRow>
                ) : null}
                {popularItems.length > 0 ? (
                  <ConversationRow
                    title="Popular now"
                    subtitle={`${popularItems.length} videos`}
                    seeAllHref="/app/catalog"
                  >
                    {popularItems.map((item) => (
                      <StripCard
                        key={`pop-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        meta={`${(item.view_count ?? 0).toLocaleString()} views`}
                      />
                    ))}
                  </ConversationRow>
                ) : null}
                {shortItems.length > 0 ? (
                  <ConversationRow
                    title="Short clips"
                    subtitle={`${shortItems.length} videos`}
                    seeAllHref="/app/catalog"
                  >
                    {shortItems.map((item) => (
                      <StripCard
                        key={`short-${item.id}`}
                        to={`/app/clip/${getShortClipId(item.id)}`}
                        title={item.title}
                        imageUrl={getMediaHubThumbnail(item)}
                        meta="Short conversation"
                      />
                    ))}
                  </ConversationRow>
                ) : null}
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
                  <p className="mb-2 text-pretty text-gray-600">Video catalog needs a MediaHub API key or YouTube playlists.</p>
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
