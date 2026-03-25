import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Monitor, ClipboardList, Loader2, ListVideo, Play } from 'lucide-react';
import { catalogApi, type CatalogItem } from '../../api/catalog';

function getThumbnail(item: CatalogItem): string {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  const m = item.playUrl?.match(/list=([a-zA-Z0-9_-]+)/);
  if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
  return 'https://via.placeholder.com/400x260?text=Playlist';
}

function getTabs(isInApp: boolean) {
  const base = isInApp ? '/app' : '';
  return [
    { key: 'catalog', label: 'Catalog', icon: ListVideo, to: base ? '/app/catalog' : '/catalog' },
    { key: 'webinars', label: 'Webinars', icon: Monitor, to: base ? '/app/webinars' : '/webinars' },
    { key: 'surveys', label: 'Surveys', icon: ClipboardList, to: base ? '/app/surveys' : '/surveys' },
  ];
}

type SortKey = 'title-asc' | 'title-desc' | 'videos-desc' | 'videos-asc';

function matchesSearch(item: CatalogItem, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  if (item.title.toLowerCase().includes(needle)) return true;
  return (item.videoNames || []).some((n) => n.toLowerCase().includes(needle));
}

export default function Catalog() {
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const TABS = getTabs(isInApp);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('title-asc');
  const [minVideos, setMinVideos] = useState('');

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const filteredSorted = useMemo(() => {
    let list = playlists.filter((p) => matchesSearch(p, search));
    const min = parseInt(minVideos, 10);
    if (!isNaN(min) && min > 0) {
      list = list.filter((p) => p.videoCount >= min);
    }
    const copy = [...list];
    copy.sort((a, b) => {
      switch (sortBy) {
        case 'title-desc':
          return b.title.localeCompare(a.title, undefined, { sensitivity: 'base' });
        case 'videos-desc':
          return b.videoCount - a.videoCount;
        case 'videos-asc':
          return a.videoCount - b.videoCount;
        case 'title-asc':
        default:
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      }
    });
    return copy;
  }, [playlists, search, sortBy, minVideos]);

  return (
    <div className="bg-white min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Explore our Catalogue</h1>

        {/* Search + filters (under headline) */}
        <section className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 sm:p-5 space-y-4">
          <div>
            <label htmlFor="catalog-search" className="sr-only">
              Search playlists
            </label>
            <input
              id="catalog-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search playlists and video titles…"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-500 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
            <div className="flex flex-col gap-1 min-w-[10rem]">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="title-asc">Title (A–Z)</option>
                <option value="title-desc">Title (Z–A)</option>
                <option value="videos-desc">Most videos</option>
                <option value="videos-asc">Fewest videos</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[8rem]">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Min. videos</span>
              <select
                value={minVideos}
                onChange={(e) => setMinVideos(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              >
                <option value="">Any</option>
                <option value="1">1+</option>
                <option value="3">3+</option>
                <option value="5">5+</option>
                <option value="10">10+</option>
              </select>
            </div>
            <p className="text-sm text-gray-600 sm:ml-auto sm:self-end">
              <span className="font-semibold text-gray-900">{filteredSorted.length}</span> playlist
              {filteredSorted.length !== 1 ? 's' : ''}
            </p>
          </div>
        </section>

        <section className="flex flex-wrap gap-4">
          {TABS.map(({ key, label, icon: Icon, to }) => (
            <Link
              key={key}
              to={to}
              className={`flex flex-col items-center gap-2 transition-colors ${
                key === 'catalog' ? 'text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900'
              }`}
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
            </div>
          ) : playlists.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
              <p className="text-gray-600 mb-2">No playlists available.</p>
              <p className="text-sm text-gray-500 mb-4">
                Configure YouTube API key and playlist IDs in the backend to display playlists.
              </p>
              <Link
                to={isInApp ? '/app/catalog' : '/catalog'}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Browse Catalog
              </Link>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
              <p className="font-semibold text-gray-900">No playlists match your filters</p>
              <p className="mt-1 text-sm text-gray-600">Try a different search or reset filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setMinVideos('');
                  setSortBy('title-asc');
                }}
                className="mt-4 rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Reset
              </button>
            </div>
          ) : (
            filteredSorted.map((item) => {
              const playlistUrl = isInApp ? `/app/catalog/playlist/${item.id}` : `/catalog/playlist/${item.id}`;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full min-h-[420px]"
                >
                  <div className="aspect-video relative shrink-0 bg-gray-100">
                    <Link to={playlistUrl} className="block h-full">
                      <img
                        src={getThumbnail(item)}
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
                  <div className="p-5 flex flex-col flex-1 min-h-0 min-w-0">
                    <Link to={playlistUrl} className="block min-w-0">
                      <h3 className="font-bold text-gray-900 hover:underline line-clamp-2 min-h-[3.5rem]">
                        {item.title}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-600 font-medium mt-2 shrink-0">
                      {item.videoCount} video{item.videoCount !== 1 ? 's' : ''}
                    </p>
                    <ul className="space-y-1 flex-1 mt-3 min-h-0">
                      {(item.videoNames || []).slice(0, 4).map((v, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                          <span className="h-1 w-1 rounded-full bg-gray-400 shrink-0" />
                          <span className="truncate" title={v}>
                            {v}
                          </span>
                        </li>
                      ))}
                      {item.videoCount > 4 && (
                        <li className="text-sm text-gray-500 truncate">+{item.videoCount - 4} more…</li>
                      )}
                    </ul>
                    <div className="flex justify-end mt-4 pt-2 border-t border-gray-100 shrink-0">
                      <Link
                        to={playlistUrl}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                      >
                        <Play className="h-4 w-4" />
                        Play all
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}
