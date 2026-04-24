import { Link } from 'react-router-dom';
import type { MediaHubClip } from '../../api/catalog';
import { getMediaHubThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';

type ConversationsClipCardProps = {
  item: MediaHubClip;
  href: string;
};

/**
 * Replit VideoCard-style tile: 249/140 still, tight radius, image outline, title only below (dense grid).
 */
export function ConversationsClipCard({ item, href }: ConversationsClipCardProps) {
  const desc =
    clipDisplaySummary(item)?.trim() ||
    item.doctors?.filter(Boolean).join(' · ') ||
    (item.view_count != null ? `${item.view_count.toLocaleString()} views` : '');
  return (
    <Link
      to={href}
      className="group flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.15)] active:scale-[0.96] dark:bg-zinc-900"
    >
      <div className="relative aspect-[249/140] w-full overflow-hidden">
        <img
          src={getMediaHubThumbnail(item)}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
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
