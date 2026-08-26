import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Rail, Thumb } from '../ui';
import type { MediaHubClip } from '../../api/catalog';
import { nextCatalogThumbnailFallback } from '../../utils/clipUrl';
import {
  catalogConversationBrowseFingerFromHref,
  catalogConversationBrowseFingerFromLocation,
} from '../../utils/catalogBrowseLocation';

/**
 * A themed row on the Conversations tab: section head, then a rail that
 * runs off the edge of the shell instead of stopping inside the gutter.
 *
 * This is the token-era counterpart to `home/ConversationRow`, which the
 * signed-out home and the dashboard still use. It is a separate component
 * rather than a rewrite of that one so those two surfaces are untouched.
 */
export function CatalogRow({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel = 'See all in library',
  children,
}: {
  title: string;
  subtitle?: string;
  seeAllHref: string;
  seeAllLabel?: string;
  children: ReactNode;
}) {
  const location = useLocation();
  const headingId = `catalog-row-${title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

  /* Same guard the strip rows carry: when "see all" points at the view we
     are already on, React Router no-ops and the click looks broken, so
     scroll to the top instead of navigating nowhere. */
  const handleSeeAllClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const destFinger = catalogConversationBrowseFingerFromHref(seeAllHref);
    const hereFinger = catalogConversationBrowseFingerFromLocation(location);
    if (destFinger && hereFinger && destFinger === hereFinger) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id={headingId} className="display text-display-s text-text">
            {title}
          </h2>
          {subtitle ? <p className="meta mt-1.5 tabular-nums text-faint">{subtitle}</p> : null}
        </div>
        <Link
          to={seeAllHref}
          onClick={handleSeeAllClick}
          className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover"
        >
          {seeAllLabel}
          <ArrowRight className="size-4" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>

      {/* The rail bleeds into the gutter so a tile runs off the edge
          rather than being clipped short of it. Mandatory snapping
          measures from the padding box, though, so without a matching
          scroll-padding it snaps the first tile INTO the gutter and the
          row starts a gutter's width left of its own heading. */}
      <Rail
        className="mt-6 [scroll-padding-inline-start:var(--page-gutter,1rem)]"
        aria-label={title}
      >
        {children}
      </Rail>
    </section>
  );
}

/**
 * One tile in a rail. The card treatment is the shared `.card` (surface,
 * elevation, 2px hover lift) and the poster is the shared `Thumb`, whose
 * scrim strip carries the mark and the runtime.
 *
 * `hideOnBrokenPoster` reproduces the strip card's behaviour: walk down
 * the YouTube poster sizes, and when none of them resolve, drop the tile
 * rather than leaving a grey rectangle in the row.
 */
export function CatalogSessionCard({
  to,
  title,
  description,
  imageUrl,
  duration,
  clip,
  hideOnBrokenPoster = false,
  onPosterFailed,
}: {
  to: string;
  title: string;
  description?: string;
  imageUrl: string;
  duration?: string;
  /** Handed to the detail route as router state, exactly as the grid does. */
  clip?: MediaHubClip;
  hideOnBrokenPoster?: boolean;
  onPosterFailed?: () => void;
}) {
  const [src, setSrc] = useState(imageUrl);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(imageUrl);
    setFailed(false);
  }, [imageUrl]);

  const handleError = () => {
    const videoId = src.match(/\/vi\/([a-zA-Z0-9_-]{11})\//)?.[1] ?? null;
    const next = nextCatalogThumbnailFallback(src, videoId);
    if (next) {
      setSrc(next);
      return;
    }
    onPosterFailed?.();
    if (hideOnBrokenPoster) setFailed(true);
  };

  /* YouTube answers a missing video with a 120x90 grey box and an HTTP
     200, so a poster that "loaded" still has to be measured. */
  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalWidth <= 120 && img.naturalHeight <= 90) handleError();
  };

  if (failed) return null;

  return (
    <li className="w-[15.5rem] shrink-0 snap-start sm:w-[17.5rem]">
      <Link
        to={to}
        state={clip ? { clip } : undefined}
        className="card press group flex h-full flex-col p-3"
      >
        <Thumb
          src={src}
          duration={duration}
          className="aspect-video w-full"
          onError={handleError}
          onLoad={handleLoad}
        />
        <div className="flex flex-1 flex-col px-1 pt-3.5 pb-1">
          <h3 className="display line-clamp-2 text-body-m text-text">{title}</h3>
          {description ? (
            <p className="meta mt-auto pt-3 line-clamp-1 text-faint" title={description}>
              {description}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

/** Placeholder tiles at the rail's own footprint, so nothing reflows. */
export function CatalogRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="w-[15.5rem] shrink-0 snap-start sm:w-[17.5rem]" aria-hidden>
          <div className="card flex h-full flex-col p-3">
            <div className="aspect-video w-full animate-pulse rounded-[6px] bg-surface-2" />
            <div className="px-1 pt-3.5 pb-1">
              <div className="h-4 w-[88%] animate-pulse rounded-[6px] bg-surface-2" />
              <div className="mt-3 h-3 w-[60%] animate-pulse rounded-[6px] bg-surface-2" />
            </div>
          </div>
        </li>
      ))}
    </>
  );
}
