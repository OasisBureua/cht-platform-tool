import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { MediaHubClip } from '../../api/catalog';
import {
  extractYoutubeVideoIdFromUrl,
  getMediaHubThumbnail,
  getShortClipId,
  nextCatalogThumbnailFallback,
} from '../../utils/clipUrl';
import { clipStripeSubtitle } from '../../utils/mediaHubClipText';

type ConversationsClipCardProps = {
  item: MediaHubClip;
  href: string;
};

/** YouTube serves a 120×90 gray box (HTTP 200) for missing videos — treat as failure. */
function isYoutubeMissingPoster(img: HTMLImageElement): boolean {
  return img.naturalWidth > 0 && img.naturalWidth <= 120 && img.naturalHeight <= 90;
}

/**
 * Dense catalog tile. Falls back through YouTube poster sizes on 404 / missing poster;
 * hides when the video is unavailable.
 */
export function ConversationsClipCard({ item, href }: ConversationsClipCardProps) {
  const videoId =
    extractYoutubeVideoIdFromUrl(item.youtube_url || item.youtubeUrl) ||
    (/^[a-zA-Z0-9_-]{11}$/.test(getShortClipId(item.id)) ? getShortClipId(item.id) : null);
  const [thumbSrc, setThumbSrc] = useState(() => getMediaHubThumbnail(item));
  const [hidden, setHidden] = useState(false);
  const desc =
    clipStripeSubtitle(item)?.trim() ||
    (item.view_count != null ? `${item.view_count.toLocaleString()} views` : '');

  useEffect(() => {
    setThumbSrc(getMediaHubThumbnail(item));
    setHidden(false);
  }, [item.id, item.thumbnail_url, item.youtube_url, item.youtubeUrl]);

  const advanceOrHide = (current: string) => {
    const next = nextCatalogThumbnailFallback(current, videoId);
    if (next) setThumbSrc(next);
    else setHidden(true);
  };

  if (hidden) return null;

  return (
    <Link
      to={href}
      state={{ clip: item }}
      className="group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.15)] active:scale-[0.96] dark:bg-zinc-900"
    >
      <div className="relative aspect-[249/140] w-full overflow-hidden">
        <img
          src={thumbSrc}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={() => advanceOrHide(thumbSrc)}
          onLoad={(e) => {
            if (isYoutubeMissingPoster(e.currentTarget)) advanceOrHide(thumbSrc);
          }}
        />
      </div>
      <div className="flex min-h-[5.25rem] flex-1 flex-col p-2.5 pt-2">
        <p
          className="line-clamp-2 text-left text-[13px] font-semibold leading-snug text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100"
          title={item.title}
        >
          {item.title}
        </p>
        {desc ? (
          <p
            className="mt-1 line-clamp-1 text-left text-[11px] leading-snug text-zinc-600 [overflow-wrap:anywhere] dark:text-zinc-400"
            title={desc}
          >
            {desc}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
