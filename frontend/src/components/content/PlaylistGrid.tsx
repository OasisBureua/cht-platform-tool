import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ListVideo } from 'lucide-react';
import type { CatalogItem } from '../../api/catalog';

type PlaylistGridProps = {
  playlists: CatalogItem[];
  isInApp: boolean;
  /** Override card title (e.g. strip trailing "with Drs.…"). */
  titleForItem?: (item: CatalogItem) => string;
  /** Shown under the title on each card (e.g. speakers + video count). */
  descriptionForItem?: (item: CatalogItem) => string;
};

function PlaylistCard({
  item,
  isInApp,
  title,
  desc,
}: {
  item: CatalogItem;
  isInApp: boolean;
  title: string;
  desc: string;
}) {
  const [hidden, setHidden] = useState(false);
  const playlistUrl = isInApp ? `/app/catalog/playlist/${item.id}` : `/catalog/playlist/${item.id}`;
  const thumb = item.thumbnailUrl || '/images/placeholder-playlist.svg';

  useEffect(() => {
    setHidden(false);
  }, [thumb]);

  if (hidden) return null;

  return (
    <div className="flex h-full min-h-[280px] min-w-0 flex-col rounded-card border border-border bg-card transition-shadow hover:shadow-md">
      <div className="relative aspect-video shrink-0 overflow-hidden rounded-t-2xl bg-muted">
        <Link to={playlistUrl} className="block h-full">
          <img
            src={thumb}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setHidden(true)}
          />
        </Link>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
        <Link to={playlistUrl} className="block min-w-0">
          <h3
            className="line-clamp-3 break-words font-bold text-foreground [overflow-wrap:anywhere] hover:underline sm:line-clamp-2"
            title={item.title}
          >
            {title}
          </h3>
        </Link>
        {desc ? (
          <p className="line-clamp-4 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] sm:line-clamp-3">
            {desc}
          </p>
        ) : null}
        <div className="mt-auto flex shrink-0 justify-end border-t border-border pt-4">
          <Link
            to={playlistUrl}
            className="inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <ListVideo className="h-4 w-4 shrink-0" />
            View playlist
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PlaylistGrid({
  playlists,
  isInApp,
  titleForItem,
  descriptionForItem,
}: PlaylistGridProps) {
  if (!playlists.length) return null;

  const lineFor =
    descriptionForItem ??
    ((item: CatalogItem) => `${item.videoCount} video${item.videoCount !== 1 ? 's' : ''}`);
  const titleFor = titleForItem ?? ((item: CatalogItem) => item.title);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {playlists.map((item) => (
        <PlaylistCard
          key={item.id}
          item={item}
          isInApp={isInApp}
          title={titleFor(item)}
          desc={lineFor(item)}
        />
      ))}
    </div>
  );
}
