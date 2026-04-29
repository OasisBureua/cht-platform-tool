import { Link } from 'react-router-dom';
import type { FlatPlaylistVideo } from '../../hooks/useFlattenedPlaylistVideos';

function watchUrl(isInApp: boolean, playlistId: string, videoId: string) {
  const base = `${isInApp ? '/app' : ''}/catalog/playlist/${encodeURIComponent(playlistId)}`;
  return `${base}?v=${encodeURIComponent(videoId)}`;
}

type PlaylistVideosFlattenGridProps = {
  entries: FlatPlaylistVideo[];
  isInApp: boolean;
  /** When true, show source playlist title under the video title */
  showPlaylistTitles?: boolean;
};

/**
 * Responsive grid of YouTube-derived videos linked into `PlaylistDetail` with `?v=`.
 */
export function PlaylistVideosFlattenGrid({
  entries,
  isInApp,
  showPlaylistTitles = true,
}: PlaylistVideosFlattenGridProps) {
  if (!entries.length) return null;

  return (
    <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {entries.map(({ video, playlistId, playlistTitle }) => (
        <Link
          key={`${playlistId}-${video.id}`}
          to={watchUrl(isInApp, playlistId, video.id)}
          className="group min-w-0 overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[box-shadow,transform] hover:shadow-md active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="aspect-video w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
            <img
              src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
              alt=""
              className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 transition-transform duration-300 group-hover:scale-[1.02] dark:outline-white/10"
              loading="lazy"
              referrerPolicy="no-referrer"
              draggable={false}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 p-2.5 pt-2">
            <p className="line-clamp-2 text-left text-xs font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
              {video.title}
            </p>
            {showPlaylistTitles && playlistTitle ? (
              <p className="line-clamp-1 text-left text-[11px] text-zinc-500 dark:text-zinc-400">{playlistTitle}</p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
