import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Search, Loader2, ChevronDown, Play } from 'lucide-react';
import { catalogApi, type MediaHubClip, type MediaHubTags } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';

import { ContentLibraryNavTabs } from '../../components/content/ContentLibraryNavTabs';
import { PlaylistGrid } from '../../components/content/PlaylistGrid';

const SORT_OPTIONS = [
  { value: '', label: 'Sort by' },
  { value: 'recent', label: 'Most recent' },
  { value: 'posted', label: 'Recently posted' },
  { value: 'views', label: 'Most views' },
  { value: 'likes', label: 'Most likes' },
];

function stripTagPrefix(tag: string): string {
  return tag.replace(/^[a-z_]+:/i, '');
}

/**
 * Build tag filter options from the /tags endpoint.
 * The API returns `{ biomarker: ["HER2+", ...], drug: ["Enhertu", ...] }` (no prefix in values),
 * but the /clips?tag= filter expects the prefixed form `biomarker:HER2+`.
 * We store `category:value` as the option value and show just `value` as the label.
 * Doctor tags are excluded here — they have a dedicated filter.
 */
function flattenTags(tags: MediaHubTags): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const [category, values] of Object.entries(tags)) {
    if (category === 'doctor') continue;
    if (!Array.isArray(values)) continue;
    for (const v of values) {
      if (!v) continue;
      const apiValue = `${category}:${v}`;
      if (!seen.has(apiValue)) {
        seen.add(apiValue);
        out.push({ value: apiValue, label: v });
      }
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Build doctor filter options from the /tags "doctor" category.
 * The /clips?doctor= filter expects the short name (e.g. "Mouabbi"), which is
 * exactly what /tags returns under the "doctor" key.
 */
function getDoctorOptionsFromTags(tags: MediaHubTags): { value: string; label: string }[] {
  const doctors = tags['doctor'];
  if (!Array.isArray(doctors)) return [];
  return doctors
    .filter(Boolean)
    .map((name) => ({ value: name, label: `Dr. ${name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

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

  const tagOptions = useMemo(() => flattenTags(tags), [tags]);
  const doctorOptions = useMemo(() => getDoctorOptionsFromTags(tags), [tags]);
  const useMediaHub = tagOptions.length > 0 || doctorOptions.length > 0;

  const { data: playlists = [] } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 10 * 60 * 1000,
  });

  const {
    data: clipsData,
    isLoading: clipsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
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
    enabled: useMediaHub && libraryView === 'clips',
    staleTime: 2 * 60 * 1000,
  });

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

  const playlistDescription = (p: (typeof playlists)[0]) =>
    p.videoNames?.slice(0, 3).join(' • ') || `${p.videoCount} video${p.videoCount !== 1 ? 's' : ''}`;

  return (
    <div className="bg-white min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Explore our Catalogue</h1>

        <ContentLibraryNavTabs
          isInApp={isInApp}
          libraryView={libraryView}
          playlistsAvailable={playlists.length > 0}
          onSelectClips={() => setLibraryView('clips')}
          onSelectPlaylists={() => setLibraryView('playlists')}
        />

        {libraryView === 'clips' && useMediaHub && (
          <section className="flex flex-col md:flex-row gap-3 flex-wrap">
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

        {libraryView === 'playlists' ? (
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">YouTube playlists</h2>
            <PlaylistGrid playlists={playlists} isInApp={isInApp} descriptionForItem={playlistDescription} />
            {playlists.length === 0 ? (
              <p className="text-sm text-gray-600">No playlists configured. Add YouTube playlist IDs on the server.</p>
            ) : null}
          </section>
        ) : (
          <section className="space-y-4">
            {useMediaHub && (
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 text-balance break-words max-w-full">
                Videos
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
              {!useMediaHub && playlists.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-600 mb-2">Video catalog requires MediaHub API key or YouTube playlists.</p>
                  <p className="text-sm text-gray-500 mb-3">
                    Configure mediahub_api_key or youtube_playlist_ids in the backend.
                  </p>
                  <Link to={isInApp ? '/app/catalog' : '/catalog'} className="text-sm font-medium text-gray-900 hover:underline">
                    Browse Catalog
                  </Link>
                </div>
              ) : !useMediaHub && playlists.length > 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center space-y-4">
                  <p className="text-gray-600">MediaHub is not configured. Open Playlists above or browse the catalog.</p>
                  <Link to={isInApp ? '/app/catalog' : '/catalog'} className="text-sm font-medium text-gray-900 hover:underline">
                    Explore catalog
                  </Link>
                </div>
              ) : useMediaHub && isLoading && displayItems.length === 0 ? (
                <div className="col-span-full flex items-center justify-center py-16">
                  <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
                </div>
              ) : useMediaHub && displayItems.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-gray-600 mb-2">No results found.</p>
                  <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
                </div>
              ) : (
                displayItems.map((item) => {
                  const detailUrl = isInApp ? `/app/clip/${getShortClipId(item.id)}` : `/catalog/clip/${getShortClipId(item.id)}`;
                  const summary = clipDisplaySummary(item);
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow flex flex-col h-full min-h-[280px] min-w-0"
                    >
                      <div className="aspect-video relative shrink-0 bg-gray-100 overflow-hidden rounded-t-2xl">
                        <Link to={detailUrl} className="block h-full">
                          <img
                            src={getMediaHubThumbnail(item)}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                            <div className="rounded-full bg-white/90 p-4">
                              <Play className="h-10 w-10 text-gray-900 ml-1" fill="currentColor" />
                            </div>
                          </div>
                        </Link>
                      </div>
                      <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0 gap-2">
                        <Link to={detailUrl} className="block min-w-0">
                          <h3 className="font-bold text-gray-900 hover:underline line-clamp-3 sm:line-clamp-2 break-words [overflow-wrap:anywhere]">
                            {item.title}
                          </h3>
                        </Link>
                        {item.doctors?.length > 0 && (
                          <p className="text-xs font-medium text-gray-500 line-clamp-2 break-words [overflow-wrap:anywhere]">
                            {item.doctors.join(', ')}
                          </p>
                        )}
                        {summary ? (
                          <p className="text-sm text-gray-600 line-clamp-4 sm:line-clamp-3 leading-relaxed break-words [overflow-wrap:anywhere]">
                            {summary}
                          </p>
                        ) : null}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {item.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 max-w-full break-words text-left [overflow-wrap:anywhere]"
                                title={stripTagPrefix(tag)}
                              >
                                {stripTagPrefix(tag)}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-end mt-auto pt-4 border-t border-gray-100 shrink-0">
                          <Link
                            to={detailUrl}
                            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                          >
                            <Play className="h-4 w-4" />
                            Watch
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
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
