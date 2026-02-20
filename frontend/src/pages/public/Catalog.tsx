import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Monitor, ClipboardList, Video, Loader2, ListVideo, Play } from 'lucide-react';
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
    { key: 'videos', label: 'Videos', icon: Video, to: base ? '/app/watch' : '/watch' },
  ];
}

export default function Catalog() {
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const TABS = getTabs(isInApp);
  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="bg-white min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Explore our Catalogue</h1>

        {/* Content type tabs */}
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

        {/* Playlists grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                to={isInApp ? '/app/watch' : '/watch'}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                <Video className="h-4 w-4" />
                Browse Videos
              </Link>
            </div>
          ) : (
            playlists.map((item) => {
              const playlistUrl = isInApp ? `/app/catalog/playlist/${item.id}` : `/catalog/playlist/${item.id}`;
              const playAllUrl = item.playUrl || playlistUrl;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-52 relative">
                    <Link to={playlistUrl}>
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
                  <div className="p-5 space-y-4">
                    <Link to={playlistUrl} className="block">
                      <h3 className="font-bold text-gray-900 hover:underline">{item.title}</h3>
                    </Link>
                    <ul className="space-y-1">
                      {item.videoNames.slice(0, 4).map((v, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="h-1 w-1 rounded-full bg-gray-400" />
                          {v}
                        </li>
                      ))}
                      {item.videoCount > 4 && (
                        <li className="text-sm text-gray-500">+{item.videoCount - 4} more</li>
                      )}
                    </ul>
                    <div className="flex justify-end">
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
