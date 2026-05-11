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
          <h2 className="text-balance text-[17px] font-bold tracking-tight text-zinc-900 dark:text-zinc-50 md:text-lg">
            {title}
          </h2>
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
            className="absolute left-0 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-700 opacity-0 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] transition-[opacity,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.16)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 group-hover/row:opacity-100 md:flex dark:bg-zinc-900 dark:text-zinc-100"
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
            className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-700 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.12)] transition-[opacity,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_8px_28px_-10px_rgba(0,0,0,0.16)] focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100 dark:bg-zinc-900 dark:text-zinc-100"
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
  /**
   * Marketing homepage: wider cards (+25% vs default strip) and taller media (~+15% vs prior homepage media).
   */
  homepage?: boolean;
  /** Omit the tile when `imageUrl` fails to load (e.g. broken remote thumbnail). */
  hideThumbnailOnError?: boolean;
  /** Runs after hiding when `hideThumbnailOnError`; optional side effects (analytics, tracking failed ids upstream). */
  onThumbnailError?: () => void;
};

const stripCardShell =
  'group/card flex min-h-0 min-w-0 w-[226px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[250px] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

/** Homepage compact card: +25% width vs default shell; inner media aspect tuned ~+15% taller vs prior 16/13 */
const stripCardShellHomepage =
  'group/card flex min-h-0 min-w-0 w-[311px] flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[344px] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-900 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

const thumbnailOnlyShell =
  'group/card relative block w-[226px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[259px] aspect-video hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-800 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

/** +25% width vs thumbnailOnlyShell; aspect ~15% taller media vs prior 16/11.7 */
const thumbnailOnlyShellHomepage =
  'group/card relative block w-[311px] shrink-0 overflow-hidden rounded-xl bg-zinc-100 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] sm:w-[356px] aspect-[16/13.5] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_32px_-14px_rgba(0,0,0,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 active:scale-[0.96] dark:bg-zinc-800 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.45)]';

function StripCardInner({
  variant,
  homepage,
  title,
  imageUrl,
  description,
  meta,
  videoLabel,
  onThumbnailError,
}: Pick<
  StripCardProps,
  'variant' | 'homepage' | 'title' | 'imageUrl' | 'description' | 'meta' | 'videoLabel' | 'onThumbnailError'
>) {
  const line1 = description ?? meta;
  const v = variant ?? 'compact';
  const home = homepage === true;

  if (v === 'thumbnailOnly') {
    return (
      <>
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={onThumbnailError}
        />
        <span className="sr-only">{title}</span>
      </>
    );
  }

  return (
    <>
      <div
        className={
          home
            ? 'relative aspect-[16/15] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800'
            : 'relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800'
        }
      >
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
          onError={onThumbnailError}
        />
      </div>
      <div className={home ? 'flex min-w-0 flex-col px-2.5 pb-2.5 pt-2' : 'flex min-w-0 flex-col px-2 pb-2 pt-1.5'}>
        <p
          className={
            home
              ? 'truncate text-left text-[13px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100'
              : 'truncate text-left text-[12px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100'
          }
          title={title}
        >
          {title}
        </p>
        {line1 ? (
          <p
            className={
              home
                ? 'mt-1 truncate text-left text-[11px] leading-snug text-zinc-600 dark:text-zinc-400'
                : 'mt-0.5 truncate text-left text-[10px] leading-snug text-zinc-600 dark:text-zinc-400'
            }
            title={line1}
          >
            {line1}
          </p>
        ) : null}
        {videoLabel ? (
          <span
            className={
              home
                ? 'mt-1.5 inline-flex w-fit max-w-full items-center rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-bold tabular-nums tracking-wide text-brand-900 dark:bg-brand-950/55 dark:text-brand-100'
                : 'mt-1 inline-flex w-fit max-w-full items-center rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums tracking-wide text-brand-900 dark:bg-brand-950/55 dark:text-brand-100'
            }
          >
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
  homepage,
  hideThumbnailOnError,
  onThumbnailError,
}: StripCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => {
    setThumbFailed(false);
  }, [imageUrl]);

  const external = /^https?:\/\//i.test(to);
  const v = variant ?? 'compact';
  const compactShell = homepage ? stripCardShellHomepage : stripCardShell;
  const thumbShell = homepage ? thumbnailOnlyShellHomepage : thumbnailOnlyShell;

  if (thumbFailed) return null;

  const bubbleError = hideThumbnailOnError
    ? () => {
        onThumbnailError?.();
        setThumbFailed(true);
      }
    : onThumbnailError;

  if (v === 'thumbnailOnly') {
    return (
      <div className="snap-start" style={{ scrollSnapAlign: 'start' }}>
        {external ? (
          <a href={to} target="_blank" rel="noopener noreferrer" className={thumbShell}>
            <StripCardInner
              variant="thumbnailOnly"
              homepage={homepage}
              title={title}
              imageUrl={imageUrl}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
              onThumbnailError={bubbleError}
            />
          </a>
        ) : (
          <Link to={to} className={thumbShell}>
            <StripCardInner
              variant="thumbnailOnly"
              homepage={homepage}
              title={title}
              imageUrl={imageUrl}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
              onThumbnailError={bubbleError}
            />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="snap-start" style={{ scrollSnapAlign: 'start' }}>
      {external ? (
        <a href={to} target="_blank" rel="noopener noreferrer" className={compactShell}>
          <StripCardInner
            variant="compact"
            homepage={homepage}
            title={title}
            imageUrl={imageUrl}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
            onThumbnailError={bubbleError}
          />
        </a>
      ) : (
        <Link to={to} className={compactShell}>
          <StripCardInner
            variant="compact"
            homepage={homepage}
            title={title}
            imageUrl={imageUrl}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
            onThumbnailError={bubbleError}
          />
        </Link>
      )}
    </div>
  );
}

function RowSkeleton({ homepage }: { homepage?: boolean }) {
  const shell = homepage
    ? 'flex w-[311px] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-zinc-100/90 sm:w-[344px] dark:bg-zinc-800/80'
    : 'flex w-[226px] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-zinc-100/90 sm:w-[250px] dark:bg-zinc-800/80';
  const imgAspect = homepage ? 'aspect-[16/15]' : 'aspect-[16/10]';
  return (
    <div className={shell}>
      <div className={`${imgAspect} w-full animate-pulse bg-zinc-200/90 dark:bg-zinc-700/80`} />
      <div className={homepage ? 'space-y-1.5 px-2.5 pb-2.5 pt-2' : 'space-y-1 px-2 pb-2 pt-1.5'}>
        <div className={`animate-pulse rounded bg-zinc-200/80 ${homepage ? 'h-3.5 w-[92%]' : 'h-3 w-[92%]'}`} />
        <div className={`animate-pulse rounded bg-zinc-200/70 ${homepage ? 'h-3 w-[75%]' : 'h-2.5 w-[75%]'}`} />
        <div className={`animate-pulse rounded-md bg-zinc-200/70 ${homepage ? 'mt-1.5 h-6 w-16' : 'mt-1 h-5 w-14'}`} />
      </div>
    </div>
  );
}

export function StripRowLoading({ homepage }: { homepage?: boolean }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <RowSkeleton key={i} homepage={homepage} />
      ))}
    </>
  );
}

/** Matches `StripCard` `thumbnailOnly` — use while Featured carousel loads */
export function StripRowLoadingThumbnails({ homepage }: { homepage?: boolean }) {
  const w = homepage ? 'w-[311px] sm:w-[356px]' : 'w-[226px] sm:w-[259px]';
  const aspect = homepage ? 'aspect-[16/13.5]' : 'aspect-video';
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`${aspect} ${w} shrink-0 snap-start animate-pulse overflow-hidden rounded-xl bg-zinc-200/90 dark:bg-zinc-700/70`}
          style={{ scrollSnapAlign: 'start' }}
        />
      ))}
    </>
  );
}
