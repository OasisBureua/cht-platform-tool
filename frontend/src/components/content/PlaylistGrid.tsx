import { Link } from 'react-router-dom';
import { ListVideo } from 'lucide-react';
import type { CatalogItem } from '../../api/catalog';

type PlaylistGridProps = {
  playlists: CatalogItem[];
  isInApp: boolean;
  /** Shown under the title on each card (e.g. video count line). */
  descriptionForItem?: (item: CatalogItem) => string;
};

export function PlaylistGrid({ playlists, isInApp, descriptionForItem }: PlaylistGridProps) {
  if (!playlists.length) return null;

  const lineFor = descriptionForItem ?? ((item: CatalogItem) => `${item.videoCount} video${item.videoCount !== 1 ? 's' : ''}`);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 min-w-0">
      {playlists.map((item) => {
        const playlistUrl = isInApp ? `/app/catalog/playlist/${item.id}` : `/catalog/playlist/${item.id}`;
        const desc = lineFor(item);
        return (
          <div
            key={item.id}
            className="bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow flex flex-col h-full min-h-[280px] min-w-0"
          >
            <div className="aspect-video relative shrink-0 bg-gray-100 overflow-hidden rounded-t-2xl">
              <Link to={playlistUrl} className="block h-full">
                <img
                  src={item.thumbnailUrl || 'https://via.placeholder.com/400x260?text=Playlist'}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </Link>
            </div>
            <div className="p-4 sm:p-5 flex flex-col flex-1 min-w-0 gap-2">
              <Link to={playlistUrl} className="block min-w-0">
                <h3 className="font-bold text-gray-900 hover:underline line-clamp-3 sm:line-clamp-2 break-words [overflow-wrap:anywhere]">
                  {item.title}
                </h3>
              </Link>
              {desc ? (
                <p className="text-sm text-gray-600 line-clamp-4 sm:line-clamp-3 leading-relaxed break-words [overflow-wrap:anywhere]">
                  {desc}
                </p>
              ) : null}
              <div className="flex justify-end mt-auto pt-4 border-t border-gray-100 shrink-0">
                <Link
                  to={playlistUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <ListVideo className="h-4 w-4 shrink-0" />
                  View playlist
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
