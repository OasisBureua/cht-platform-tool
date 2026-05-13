import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Zap, Presentation, PlayCircle, ClipboardList, Loader2, Compass } from 'lucide-react';
import { webinarsApi } from '../api/webinars';
import { catalogApi, type MediaHubClip, type CatalogItem } from '../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../utils/clipUrl';
import { clipDisplaySummary } from '../utils/mediaHubClipText';
import { surveysApi } from '../api/surveys';

const FALLBACK_IMAGES = {
  webinar: '/images/iStock-2230313942-1a0d8644-fc61-4713-972b-53ca638c2a21.png',
  clip: '/images/iStock-2216489570-5b943c5f-1d37-435a-a309-e39b12f434e0.png',
  playlist: '/images/iStock-2216587796-60664d42-7776-4b9d-bbd1-5edbcdfee34c.png',
  survey: '/images/iStock-2233342016-12339015-cb72-4731-bdc1-219dc4810191.png',
} as const;

function getPlaylistThumbnail(item: CatalogItem): string {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  const m = item.playUrl?.match(/list=([a-zA-Z0-9_-]+)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return FALLBACK_IMAGES.playlist;
}

function getFallbackImage(type: 'webinar' | 'clip' | 'playlist' | 'survey'): string {
  return FALLBACK_IMAGES[type];
}

type Tab = 'best' | 'webinars' | 'videos' | 'surveys';

type UnifiedItem =
  | { type: 'webinar'; id: string; title: string; description: string; imageUrl: string; href: string }
  | { type: 'clip'; id: string; title: string; description: string; imageUrl: string; href: string; subtitle?: string }
  | { type: 'playlist'; id: string; title: string; description: string; imageUrl: string; href: string; videoNames?: string[] }
  | { type: 'survey'; id: string; title: string; description: string; imageUrl: string; href: string };

function matchesQuery(item: UnifiedItem, q: string): boolean {
  if (!q) return true;
  const lower = (q || '').trim().toLowerCase();
  if (!lower) return true;
  const title = (item.title ?? '').toLowerCase();
  const desc = (item.description ?? '').toLowerCase();
  const sub =
    item.type === 'clip' && item.subtitle ? item.subtitle.toLowerCase() : '';
  return title.includes(lower) || desc.includes(lower) || sub.includes(lower);
}

export default function ExploreOpportunities() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<Tab>('best');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: tags = {} } = useQuery({
    queryKey: ['catalog', 'tags'],
    queryFn: catalogApi.getTags,
    staleTime: 10 * 60 * 1000,
  });

  const useMediaHub = Object.keys(tags).length > 0;

  const { data: webinars = [], isLoading: webinarsLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clipsData, isLoading: clipsLoading, isError: clipsError } = useQuery({
    queryKey: ['catalog', 'clips', debouncedQuery],
    queryFn: () =>
      useMediaHub
        ? catalogApi.getClips({
            q: debouncedQuery || undefined,
            limit: 24,
            offset: 0,
          })
        : Promise.resolve({ items: [], total: 0 }),
    enabled: useMediaHub,
    staleTime: 2 * 60 * 1000,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    enabled: !useMediaHub,
    staleTime: 5 * 60 * 1000,
  });

  const { data: surveys = [], isLoading: surveysLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo((): UnifiedItem[] => {
    const out: UnifiedItem[] = [];

    webinars.forEach((w) => {
      out.push({
        type: 'webinar',
        id: `webinar-${w.id}`,
        title: w.title,
        description: w.description || '',
        imageUrl: w.imageUrl || '',
        href: `/app/live/${w.id}`,
      });
    });

    if (useMediaHub && clipsData?.items) {
      const validClips = clipsData.items.filter((c) => c && (c.id || c.title));
      validClips.forEach((c) => {
        out.push({
          type: 'clip',
          id: `clip-${c.id ?? ''}`,
          title: c.title ?? '',
          description: clipDisplaySummary(c),
          imageUrl: getMediaHubThumbnail(c) || FALLBACK_IMAGES.clip,
          href: `/app/clip/${getShortClipId(c.id ?? '')}`,
          subtitle: c.doctors?.length ? c.doctors.join(', ') : undefined,
        });
      });
    } else if (!useMediaHub) {
      playlists.forEach((p) => {
        out.push({
          type: 'playlist',
          id: `playlist-${p.id}`,
          title: p.title,
          description: p.videoNames?.slice(0, 3).join(' • ') || '',
          imageUrl: getPlaylistThumbnail(p),
          href: `/app/catalog/playlist/${p.id}`,
          videoNames: p.videoNames,
        });
      });
    }

    surveys.forEach((s) => {
      out.push({
        type: 'survey',
        id: `survey-${s.id}`,
        title: s.title || s.program?.title || 'Survey',
        description: s.description || s.program?.sponsorName || '',
        imageUrl: '',
        href: `/app/surveys/${s.id}`,
      });
    });

    return out;
  }, [webinars, clipsData, playlists, surveys, useMediaHub]);

  const filtered = useMemo(() => {
    const q = debouncedQuery;
    let list = items.filter((item) => matchesQuery(item, q));

    if (tab === 'webinars') list = list.filter((i) => i.type === 'webinar');
    else if (tab === 'videos') list = list.filter((i) => i.type === 'clip' || i.type === 'playlist');
    else if (tab === 'surveys') list = list.filter((i) => i.type === 'survey');

    return list;
  }, [items, debouncedQuery, tab]);

  const isLoading = webinarsLoading || surveysLoading || (useMediaHub ? clipsLoading : playlistsLoading);
  const showClipsError = useMediaHub && clipsError;

  const tabs = [
    { key: 'best' as Tab, label: 'Best Match', icon: Zap },
    { key: 'webinars' as Tab, label: 'LIVE', icon: Presentation },
    { key: 'videos' as Tab, label: 'Videos', icon: PlayCircle },
    { key: 'surveys' as Tab, label: 'Surveys', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center gap-2.5 text-gray-900">
        <Compass className="h-5 w-5 text-brand-700 dark:text-brand-400" strokeWidth={2} aria-hidden />
        <h1 className="text-balance text-2xl font-bold text-gray-900 md:text-3xl">Explore Opportunities</h1>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, topic, or description..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
      </div>

      {/* Category tabs - filter by type */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex min-h-[44px] flex-col items-center gap-1 rounded-xl border px-6 py-4 text-sm font-medium transition-[color,background-color,border-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] ${
              tab === key ? 'border-gray-900 bg-gray-100 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-6 w-6" />
            {label}
          </button>
        ))}
      </div>

      {/* Content grid */}
      {showClipsError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-12 text-center">
          <p className="text-amber-800 font-medium mb-2">Search temporarily unavailable</p>
          <p className="text-sm text-amber-700">Try a shorter search term or try again in a moment.</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
          <p className="text-gray-600 mb-2">No opportunities found</p>
          <p className="text-sm text-gray-500">
            {query ? 'Try a different search term or clear the filter.' : 'Content will appear here once configured.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-gray-100/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.07)] transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_36px_-14px_rgba(0,0,0,0.1)]"
            >
              <div className="h-44 shrink-0">
                <img
                  src={item.imageUrl || getFallbackImage(item.type)}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-4 flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {item.type === 'webinar' && 'LIVE'}
                    {item.type === 'clip' && 'Video'}
                    {item.type === 'playlist' && 'Playlist'}
                    {item.type === 'survey' && 'Survey'}
                  </span>
                </div>
                <h3 className="mt-1 line-clamp-2 text-balance font-bold text-gray-900">{item.title}</h3>
                <div className="flex-1 min-h-0 mt-2">
                  {item.subtitle ? (
                    <p className="text-sm text-gray-600 line-clamp-2">{item.subtitle}</p>
                  ) : item.videoNames?.length ? (
                    <ul className="space-y-1">
                      {item.videoNames.slice(0, 3).map((v, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          {v}
                        </li>
                      ))}
                    </ul>
                  ) : item.type === 'clip' ? null : (
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description || item.title}</p>
                  )}
                </div>
                <Link
                  to={item.href}
                  className="mt-4 inline-flex w-fit rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
                >
                  {item.type === 'survey' ? 'Join' : item.type === 'webinar' ? 'View Session' : 'Conversations'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
