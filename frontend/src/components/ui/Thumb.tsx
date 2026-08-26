import { ChmMark } from '../brand/ChmMark';

/**
 * A poster with the mark and runtime burned into its foot. Lifted out of
 * Home so the session widget can use the same one; the scrim strip is
 * permanently dark, so its overlays take fixed white rather than the
 * page-following tokens.
 */
export function Thumb({
  src,
  duration,
  className = '',
  onError,
}: {
  src: string;
  duration?: string;
  className?: string;
  onError?: () => void;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[6px] bg-surface-2 ${className}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={onError}
        className="absolute inset-0 size-full object-cover opacity-90 transition-[scale,opacity] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03] group-hover:opacity-100"
      />
      {/* Under the scrim this is a permanently dark strip, so the mark
          and the runtime take fixed white rather than the page tokens. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="img-ring absolute inset-0 rounded-[inherit]" />
      <ChmMark className="absolute bottom-3 start-3 size-5 text-white/80" />
      {duration ? <span className="meta absolute end-3 bottom-3 text-white/80">{duration}</span> : null}
    </div>
  );
}
