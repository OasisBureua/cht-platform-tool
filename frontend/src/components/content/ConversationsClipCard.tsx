import { Link } from 'react-router-dom';
import type { MediaHubClip } from '../../api/catalog';
import { getMediaHubThumbnail } from '../../utils/clipUrl';

type ConversationsClipCardProps = {
  item: MediaHubClip;
  href: string;
};

/**
 * Replit VideoCard-style tile: 249/140 still, tight radius, image outline, title only below (dense grid).
 */
export function ConversationsClipCard({ item, href }: ConversationsClipCardProps) {
  return (
    <Link
      to={href}
      className="group block min-w-0 overflow-hidden rounded-lg bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.15)] active:scale-[0.96]"
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
      <p className="p-2 text-left text-[13px] font-semibold leading-snug text-zinc-900 line-clamp-2 [overflow-wrap:anywhere]">{item.title}</p>
    </Link>
  );
}
