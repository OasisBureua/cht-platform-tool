import { Children, useEffect, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import {
  catalogConversationBrowseFingerFromHref,
  catalogConversationBrowseFingerFromLocation,
} from '../../utils/catalogBrowseLocation';
import { nextCatalogThumbnailFallback } from '../../utils/clipUrl';
import { Thumb } from '../ui/Thumb';

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
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);
  const seeAllExternal = /^https?:\/\//i.test(seeAllHref.trim());

  const handleCatalogSeeAllClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (seeAllExternal) return;
    const destFinger = catalogConversationBrowseFingerFromHref(seeAllHref);
    const hereFinger = catalogConversationBrowseFingerFromLocation(location);
    if (destFinger && hereFinger && destFinger === hereFinger) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

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
          <h2 className="display text-display-s text-text">
            {title}
          </h2>
          {subtitle ? (
            <span className="meta shrink-0 tabular-nums text-muted2">{subtitle}</span>
          ) : null}
        </div>
        {seeAllExternal ? (
          <a
            href={seeAllHref}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-[6px] px-1 text-body-s font-medium text-anchor hover:text-cta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-0 sm:px-0"
          >
            <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {seeAllLabel}
          </a>
        ) : (
          <Link
            to={seeAllHref}
            onClick={handleCatalogSeeAllClick}
            className="press inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-[6px] px-1 text-body-s font-medium text-anchor hover:text-cta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-0 sm:px-0"
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
            className="absolute left-0 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted2 opacity-0 shadow-card transition-[opacity,transform,box-shadow,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-text hover:shadow-card-hover focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover/row:opacity-100 md:flex"
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
            className="absolute right-0 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted2 shadow-card transition-[opacity,transform,box-shadow,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-text hover:shadow-card-hover focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:opacity-0 md:transition-opacity md:group-hover/row:opacity-100"
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
   * `compact`: thumbnail + tight text; height follows content (default).
   * `thumbnailOnly`: poster-style tile; title exposed to AT via sr-only (use when the row heading supplies context).
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

/**
 * Strip card surface. `.card` carries the surface, the elevation and the
 * 2px hover lift, so the four shells below no longer hand-roll an rgba
 * shadow per appearance. Widths are unchanged, so the row keeps its
 * rhythm; what changed is the treatment inside it.
 *
 * The bare `group` sits alongside `group/card` because `<Thumb>` scales
 * its poster on an unnamed `group-hover`.
 */
const stripCardShell =
  'card group group/card flex min-h-0 min-w-0 w-[226px] flex-col p-3 text-left sm:w-[250px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]';

/** Homepage compact card: +25% width vs default shell; inner media aspect tuned ~+15% taller vs prior 16/13 */
const stripCardShellHomepage =
  'card group group/card flex min-h-0 min-w-0 w-[311px] flex-col p-3.5 text-left sm:w-[344px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]';

const thumbnailOnlyShell =
  'card group group/card relative block w-[226px] shrink-0 overflow-hidden bg-surface-2 sm:w-[259px] aspect-video focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]';

/** +25% width vs thumbnailOnlyShell; aspect ~15% taller media vs prior 16/11.7 */
const thumbnailOnlyShellHomepage =
  'card group group/card relative block w-[311px] shrink-0 overflow-hidden bg-surface-2 sm:w-[356px] aspect-[16/13.5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]';

function isYoutubeMissingPoster(img: HTMLImageElement): boolean {
  return img.naturalWidth > 0 && img.naturalWidth <= 120 && img.naturalHeight <= 90;
}

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
  const onLoadCheck = onThumbnailError
    ? (e: SyntheticEvent<HTMLImageElement>) => {
        if (isYoutubeMissingPoster(e.currentTarget)) onThumbnailError();
      }
    : undefined;

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
          onLoad={onLoadCheck}
        />
        <span className="sr-only">{title}</span>
      </>
    );
  }

  return (
    <>
      {/* The poster is the shared `Thumb`: rounded, ringed, with the mark
          and its own scrim burned into the foot. */}
      <Thumb
        src={imageUrl}
        className={home ? 'aspect-[16/15] w-full shrink-0' : 'aspect-[16/10] w-full shrink-0'}
        onError={onThumbnailError}
        onLoad={onLoadCheck}
      />
      <div className={home ? 'flex min-w-0 flex-col px-0.5 pt-3' : 'flex min-w-0 flex-col px-0.5 pt-2.5'}>
        <p
          className={
            home
              ? 'display truncate text-left text-body-m text-text'
              : 'display truncate text-left text-body-s text-text'
          }
          title={title}
        >
          {title}
        </p>
        {line1 ? (
          <p className="meta mt-1 truncate text-left text-muted2" title={line1}>
            {line1}
          </p>
        ) : null}
        {videoLabel ? (
          <span
            className={
              home
                ? 'meta mt-2 inline-flex w-fit max-w-full items-center rounded-[6px] bg-surface-2 px-2 py-0.5 tabular-nums text-dim'
                : 'meta mt-1.5 inline-flex w-fit max-w-full items-center rounded-[6px] bg-surface-2 px-1.5 py-0.5 tabular-nums text-dim'
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
  const [thumbSrc, setThumbSrc] = useState(imageUrl);
  const [thumbFailed, setThumbFailed] = useState(false);
  useEffect(() => {
    setThumbSrc(imageUrl);
    setThumbFailed(false);
  }, [imageUrl]);

  const external = /^https?:\/\//i.test(to);
  const v = variant ?? 'compact';
  const compactShell = homepage ? stripCardShellHomepage : stripCardShell;
  const thumbShell = homepage ? thumbnailOnlyShellHomepage : thumbnailOnlyShell;

  if (thumbFailed) return null;

  const handleThumbError = () => {
    if (hideThumbnailOnError) {
      const videoId = thumbSrc.match(/\/vi\/([a-zA-Z0-9_-]{11})\//)?.[1] ?? null;
      const next = nextCatalogThumbnailFallback(thumbSrc, videoId);
      if (next) {
        setThumbSrc(next);
        return;
      }
      onThumbnailError?.();
      setThumbFailed(true);
      return;
    }
    onThumbnailError?.();
  };

  if (v === 'thumbnailOnly') {
    return (
      <div className="snap-start" style={{ scrollSnapAlign: 'start' }}>
        {external ? (
          <a href={to} target="_blank" rel="noopener noreferrer" className={thumbShell}>
            <StripCardInner
              variant="thumbnailOnly"
              homepage={homepage}
              title={title}
              imageUrl={thumbSrc}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
              onThumbnailError={handleThumbError}
            />
          </a>
        ) : (
          <Link to={to} className={thumbShell}>
            <StripCardInner
              variant="thumbnailOnly"
              homepage={homepage}
              title={title}
              imageUrl={thumbSrc}
              description={description}
              meta={meta}
              videoLabel={videoLabel}
              onThumbnailError={handleThumbError}
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
            imageUrl={thumbSrc}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
            onThumbnailError={handleThumbError}
          />
        </a>
      ) : (
        <Link to={to} className={compactShell}>
          <StripCardInner
            variant="compact"
            homepage={homepage}
            title={title}
            imageUrl={thumbSrc}
            description={description}
            meta={meta}
            videoLabel={videoLabel}
            onThumbnailError={handleThumbError}
          />
        </Link>
      )}
    </div>
  );
}

function RowSkeleton({ homepage }: { homepage?: boolean }) {
  /** Mirrors the live card: `.card` surface, padded, rounded poster. */
  const shell = homepage
    ? 'card flex w-[311px] shrink-0 snap-start flex-col p-3.5 sm:w-[344px]'
    : 'card flex w-[226px] shrink-0 snap-start flex-col p-3 sm:w-[250px]';
  const imgAspect = homepage ? 'aspect-[16/15]' : 'aspect-[16/10]';
  return (
    <div className={shell}>
      <div className={`${imgAspect} w-full animate-pulse rounded-[6px] bg-surface-2`} />
      <div className={homepage ? 'space-y-1.5 px-0.5 pt-3' : 'space-y-1 px-0.5 pt-2.5'}>
        <div className={`animate-pulse rounded bg-surface-2 ${homepage ? 'h-3.5 w-[92%]' : 'h-3 w-[92%]'}`} />
        <div className={`animate-pulse rounded bg-surface-2 ${homepage ? 'h-3 w-[75%]' : 'h-2.5 w-[75%]'}`} />
        <div className={`animate-pulse rounded-[6px] bg-surface-2 ${homepage ? 'mt-1.5 h-6 w-16' : 'mt-1 h-5 w-14'}`} />
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

/** Matches `StripCard` `thumbnailOnly`: use while Featured carousel loads */
export function StripRowLoadingThumbnails({ homepage }: { homepage?: boolean }) {
  const w = homepage ? 'w-[311px] sm:w-[356px]' : 'w-[226px] sm:w-[259px]';
  const aspect = homepage ? 'aspect-[16/13.5]' : 'aspect-video';
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`${aspect} ${w} shrink-0 snap-start animate-pulse overflow-hidden rounded-card bg-surface-2`}
          style={{ scrollSnapAlign: 'start' }}
        />
      ))}
    </>
  );
}
