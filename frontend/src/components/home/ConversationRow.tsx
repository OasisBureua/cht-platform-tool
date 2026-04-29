import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';

export type ConversationRowProps = {
  title: string;
  subtitle?: string;
  seeAllHref: string;
  /** Defaults to "See all in library" */
  seeAllLabel?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Replit-style horizontal row: title, subtitle, link, scroll-snap strip, chevrons on md+.
 * Light mode: layered shadow on arrow buttons, 44px hit targets.
 */
export function ConversationRow({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = 'See all in library',
  className = '',
  children,
}: ConversationRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const seeAllExternal = /^https?:\/\//i.test(seeAllHref.trim());

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  const childCount = Children.count(children);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [childCount]);

  const scroll = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className={`group/row relative ${className}`.trim()}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-2">
          <h2 className="text-balance text-[17px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-lg">{title}</h2>
          {subtitle ? (
            <span className="shrink-0 text-xs font-medium text-zinc-500 tabular-nums dark:text-zinc-400 md:text-sm">{subtitle}</span>
          ) : null}
        </div>
        {seeAllExternal ? (
          <a
            href={seeAllHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:min-h-0 sm:px-0 active:scale-[0.96] dark:text-brand-300 dark:hover:text-brand-200"
          >
            <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {seeAllLabel}
          </a>
        ) : (
          <Link
            to={seeAllHref}
            className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-brand-700 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-brand-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:min-h-0 sm:px-0 active:scale-[0.96] dark:text-brand-300 dark:hover:text-brand-200"
          >
            <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {seeAllLabel}
          </Link>
        )}

      </div>

      <div className="relative -mx-1 px-1">
        {canLeft ? (
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scroll(-1)}
            className="absolute left-0 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/5 bg-white text-zinc-700 opacity-0 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] transition-[opacity,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_12px_28px_-10px_rgba(0,0,0,0.14)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 group-hover/row:opacity-100 md:flex dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}

        <div
          ref={scrollerRef}
          className="flex gap-3 overflow-x-auto scroll-smooth pb-1 [-webkit-overflow-scrolling:touch] scrollbar-hide"
          style={{ scrollSnapType: 'x proximity' }}
        >
          {children}
        </div>

        {canRight ? (
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scroll(1)}
            className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/5 bg-white text-zinc-700 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.12)] transition-[opacity,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_12px_28px_-10px_rgba(0,0,0,0.14)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export type StripCardProps = {
  to: string;
  title: string;
  imageUrl: string;
  /** One line under the title (summary, speakers, date, first clip title, etc.) */
  description?: string;
  /** @deprecated Prefer `description`. Kept for call sites still passing `meta`. */
  meta?: string;
  /** Playlist-style count line, shown prominently below the description */
  videoLabel?: string;
  /**
   * `compact` — thumbnail + tight text; height follows content (default).
   * `thumbnailOnly` — poster-style tile; title exposed to AT via sr-only (use when the row heading supplies context).
   */
  variant?: 'compact' | 'thumbnailOnly';
};

const stripCardShell =
  'group/card flex min-h-0 min-w-0 w-[226px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[250px] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

const thumbnailOnlyShell =
  'group/card relative block w-[226px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[259px] aspect-video hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-800 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

function StripCardInner({
  variant,
  title,
  imageUrl,
  description,
  meta,
  videoLabel,
}: Pick<StripCardProps, 'variant' | 'title' | 'imageUrl' | 'description' | 'meta' | 'videoLabel'>) {
  const line1 = description ?? meta;
  const v = variant ?? 'compact';

  if (v === 'thumbnailOnly') {
    return (
      <>
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
        />
        <span className="sr-only">{title}</span>
      </>
    );
  }

  return (
    <>
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </div>
      <div className="flex min-w-0 flex-col px-2 pb-2 pt-1.5">
        <p className="truncate text-left text-[12px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100" title={title}>
          {title}
        </p>
        {line1 ? (
          <p
            className="mt-0.5 truncate text-left text-[10px] leading-snug text-zinc-600 dark:text-zinc-400"
            title={line1}
          >
            {line1}
          </p>
        ) : null}
        {videoLabel ? (
          <span className="mt-1 inline-flex w-fit max-w-full items-center rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide text-brand-900 dark:bg-brand-950/55 dark:text-brand-100">
            {videoLabel}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function StripCard({
  to,
  title,
  imageUrl,
  description,
  meta,
  videoLabel,
  variant,
}: StripCardProps) {
  const external = /^https?:\/\//i.test(to);
  const v = variant ?? 'compact';

  if (v === 'thumbnailOnly') {
    return (
      <div className="snap-start" style={{ scrollSnapAlign: 'start' }}>
        {external ? (
          <a href={to} target="_blank" rel="noopener noreferrer" className={thumbnailOnlyShell}>
            <StripCardInner
              variant="thumbnailOnly"
              title={title}
              imageUrl={imageUrl}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
            />
          </a>
        ) : (
          <Link to={to} className={thumbnailOnlyShell}>
            <StripCardInner
              variant="thumbnailOnly"
              title={title}
              imageUrl={imageUrl}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
            />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="snap-start" style={{ scrollSnapAlign: 'start' }}>
      {external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" className={stripCardShell}>
          <StripCardInner
            variant="compact"
            title={title}
            imageUrl={imageUrl}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
          />
        </a>
      ) : (
        <Link to={to} className={stripCardShell}>
          <StripCardInner
            variant="compact"
            title={title}
            imageUrl={imageUrl}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
          />
        </Link>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex w-[226px] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-zinc-100/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] sm:w-[250px] dark:bg-zinc-800/80 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="aspect-[16/10] w-full animate-pulse bg-zinc-200/90 dark:bg-zinc-700/80" />
      <div className="space-y-1 px-2 pb-2 pt-1.5">
        <div className="h-3 w-[92%] animate-pulse rounded bg-zinc-200/80" />
        <div className="h-2.5 w-[75%] animate-pulse rounded bg-zinc-200/70" />
        <div className="mt-1 h-5 w-14 animate-pulse rounded-md bg-zinc-200/70" />
      </div>
    </div>
  );
}

export function StripRowLoading() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </>
  );
}

/** Matches `StripCard` `thumbnailOnly` — use while Featured carousel loads */
export function StripRowLoadingThumbnails() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="aspect-video w-[226px] shrink-0 snap-start animate-pulse overflow-hidden rounded-xl bg-zinc-200/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] sm:w-[259px] dark:bg-zinc-700/70 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          style={{ scrollSnapAlign: 'start' }}
        />
      ))}
    </>
  );
}
