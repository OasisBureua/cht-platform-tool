import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Search, Monitor, ClipboardList, Video, Loader2, ChevronDown, ListVideo } from 'lucide-react';
import { catalogApi, type MediaHubClip, type MediaHubTags } from '../../api/catalog';

const SORT_OPTIONS = [
  { value: '', label: 'Sort by' },
  { value: 'recent', label: 'Most recent' },
  { value: 'posted', label: 'Recently posted' },
  { value: 'views', label: 'Most views' },
  { value: 'likes', label: 'Most likes' },
];

function getThumbnail(clip: MediaHubClip): string {
  if (clip.thumbnail_url) return clip.thumbnail_url;
  const m = clip.youtube_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return 'https://via.placeholder.com/400x260?text=Video';
}

function getSubtitle(clip: MediaHubClip): string[] {
  return clip.doctors?.length ? clip.doctors : [clip.title];
}

function flattenTags(tags: MediaHubTags): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const [category, values] of Object.entries(tags)) {
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

function getDoctorOptions(tags: MediaHubTags, doctors: { slug: string }[]): { value: string; label: string }[] {
  const doctorTags = tags.doctor;
  if (Array.isArray(doctorTags) && doctorTags.length > 0) {
    return doctorTags
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ value: name, label: `Dr. ${name}` }));
  }
  const slugToDisplayName = (slug: string) => {
    const cleaned = slug.replace(/^dr-?/i, '').replace(/-/g, ' ');
    const parts = cleaned.split(/\s+/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return `Dr. ${parts.join(' ')}`;
  };
  return doctors.map((d) => ({ value: d.slug, label: slugToDisplayName(d.slug) }));
}

const SEARCH_DEBOUNCE_MS = 300;
const CLIPS_PAGE_SIZE = 24;

function getTabs(isInApp: boolean) {
  const base = isInApp ? '/app' : '';
  return [
    { key: 'catalog', label: 'Catalog', icon: ListVideo, to: base ? '/app/catalog' : '/catalog' },
    { key: 'webinars', label: 'Webinars', icon: Monitor, to: base ? '/app/webinars' : '/webinars' },
    { key: 'surveys', label: 'Surveys', icon: ClipboardList, to: base ? '/app/surveys' : '/surveys' },
    { key: 'videos', label: 'Videos', icon: Video, to: base ? '/app/watch' : '/watch' },
  ];
}

export default function VideosPage() {
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const TABS = getTabs(isInApp);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOpen, setSortOpen] = useState(false);

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
  const doctorOptions = useMemo(() => getDoctorOptions(tags, doctors), [tags, doctors]);
  const useMediaHub = tagOptions.length > 0;

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
      const loaded = allPages.reduce((acc, p) => acc + p.items.length, 0);
      return lastPage.items.length === CLIPS_PAGE_SIZE ? loaded : undefined;
    },
    initialPageParam: 0,
    enabled: useMediaHub,
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
    () => clipsData?.pages?.flatMap((p) => p.items) ?? [],
    [clipsData?.pages],
  );

  const displayItems = useMediaHub ? mediaHubItems : [];
  const isLoading = useMediaHub ? clipsLoading : false;

  return (
    <div className="bg-white min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Videos</h1>

        {/* Content type tabs */}
        <section className="flex flex-wrap gap-4">
          {TABS.map(({ key, label, icon: Icon, to }) => (
            <Link
              key={key}
              to={to}
              className={`flex flex-col items-center gap-2 transition-colors ${
                location.pathname === to ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </section>

        {/* Search + Filters */}
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
              onClick={() => setSortOpen(!sortOpen)}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 inline-flex items-center gap-2 min-w-[140px] justify-between"
            >
              {SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? 'Sort by'}
              <ChevronDown className={`h-4 w-4 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 rounded-xl border border-gray-200 bg-white py-1 shadow-lg min-w-[160px]">
                  {SORT_OPTIONS.filter((o) => o.value !== '').map((opt) => (
                    <button
                      key={opt.value}
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

        {/* Clips grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!useMediaHub ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-600 mb-2">Video catalog requires MediaHub configuration.</p>
              <Link to={isInApp ? '/app/catalog' : '/catalog'} className="text-sm font-medium text-gray-900 hover:underline">
                Browse playlists in Catalog
              </Link>
            </div>
          ) : isLoading && displayItems.length === 0 ? (
            <div className="col-span-full flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : displayItems.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-600 mb-2">No results found.</p>
              <p className="text-sm text-gray-500">Try adjusting your search or filters.</p>
            </div>
          ) : (
            displayItems.map((item) => {
              const detailUrl = isInApp ? `/app/clip/${item.id}` : `/catalog/clip/${item.id}`;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-52 relative">
                    <Link to={detailUrl}>
                      <img
                        src={getThumbnail(item)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </Link>
                  </div>
                  <div className="p-5 space-y-4">
                    <Link to={detailUrl} className="block">
                      <h3 className="font-bold text-gray-900 hover:underline">{item.title}</h3>
                    </Link>
                    <ul className="space-y-1">
                      {getSubtitle(item).slice(0, 4).map((v, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          {v}
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end">
                      <Link
                        to={detailUrl}
                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                      >
                        Watch
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {useMediaHub && (
            <div ref={loadMoreRef} className="col-span-full flex justify-center py-8">
              {isFetchingNextPage && <Loader2 className="h-8 w-8 animate-spin text-gray-400" />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
