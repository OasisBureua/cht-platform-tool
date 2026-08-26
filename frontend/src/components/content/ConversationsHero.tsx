import { Link } from 'react-router-dom';
import { Play, Info } from 'lucide-react';
import type { MediaHubClip } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';
import { doctorLabelFromSlug } from '../../utils/doctorLabel';

type ConversationsHeroProps = {
  clip: MediaHubClip;
  isInApp: boolean;
};

/**
 * The featured strip that opens the Conversations tab: one poster running
 * the full width of the shell, with the eyebrow, title, lede, faculty and
 * the two actions stacked over its dark end.
 *
 * Everything inside the scrim is on a PERMANENTLY dark field, so the text
 * here is fixed white and the eyebrow takes `amber-on-deep` rather than
 * the page-following tokens: `text-dim` on this image would resolve to
 * dark grey on black in the light appearance and disappear.
 */
export function ConversationsHero({ clip, isInApp }: ConversationsHeroProps) {
  const playHref = isInApp
    ? `/app/clip/${getShortClipId(clip.id)}`
    : `/catalog/clip/${getShortClipId(clip.id)}`;
  const thumb = getMediaHubThumbnail(clip);
  const summary = clipDisplaySummary(clip);
  const body = (summary && summary.trim()) || (clip.description && clip.description.trim()) || '';
  const tag = Array.isArray(clip.tags)
    ? String(clip.tags.find((t) => t && !String(t).startsWith('brand:')) ?? 'Featured')
    : 'Featured';
  const speakerLine = (clip.doctors ?? [])
    .filter(Boolean)
    .slice(0, 3)
    .map((d) => doctorLabelFromSlug(d))
    .join(' · ');

  return (
    <section
      className={['relative overflow-hidden shadow-pop', isInApp ? 'rounded-none' : 'rounded-card'].join(
        ' ',
      )}
      aria-label="Featured conversation"
    >
      <div className="relative h-[min(56vh,520px)] min-h-[300px] w-full sm:min-h-[340px] md:h-[min(58vh,580px)]">
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
          loading="eager"
          draggable={false}
          referrerPolicy="no-referrer"
        />

        {/* Two scrims: one along the reading edge, one along the foot. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 start-0 w-[72%] bg-gradient-to-r from-black/80 via-black/35 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] bg-gradient-to-t from-black/80 via-black/25 to-transparent"
        />

        <div className="relative z-10 flex h-full max-w-[44rem] flex-col justify-end px-5 pb-9 pt-24 sm:px-8 sm:pb-11 md:px-12">
          <p className="eyebrow text-amber-on-deep">{tag}</p>
          <h2 className="display mt-3 text-balance text-[2rem] leading-[1.04] tracking-[-0.03em] text-white sm:text-[2.5rem] md:text-[3rem]">
            {clip.title}
          </h2>
          {body ? (
            <p
              className="prose-lede mt-4 line-clamp-2 max-w-[52ch] text-body-m text-white/75"
              title={body}
            >
              {body}
            </p>
          ) : null}
          {speakerLine ? <p className="meta mt-3 text-white/60">{speakerLine}</p> : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={playHref}
              state={{ clip }}
              className="hero-play-btn press inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-[6px] bg-white px-6 font-mono text-[0.875rem] font-normal tracking-[-0.011em] text-on-bright hover:bg-white/90"
            >
              <Play className="size-4 shrink-0" aria-hidden fill="currentColor" strokeWidth={0} />
              Play
            </Link>
            <Link
              to={playHref}
              state={{ clip }}
              className="press inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-[6px] bg-white/12 px-6 font-mono text-[0.875rem] font-normal tracking-[-0.011em] text-white backdrop-blur-sm hover:bg-white/25"
            >
              <Info className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
              More detail
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Same footprint as the hero, so the page does not jump when it lands. */
export function ConversationsHeroSkeleton({ isInApp = true }: { isInApp?: boolean }) {
  return (
    <div
      className={[
        'h-[min(56vh,520px)] min-h-[300px] overflow-hidden bg-surface-2 shadow-pop sm:min-h-[340px] md:h-[min(58vh,580px)]',
        isInApp ? 'rounded-none' : 'rounded-card',
      ].join(' ')}
      aria-hidden
    >
      <div className="flex h-full max-w-[44rem] flex-col justify-end px-5 pb-9 sm:px-8 sm:pb-11 md:px-12">
        <div className="h-3 w-28 animate-pulse rounded-[6px] bg-surface" />
        <div className="mt-4 h-9 w-4/5 max-w-lg animate-pulse rounded-[6px] bg-surface" />
        <div className="mt-3 h-4 w-full max-w-sm animate-pulse rounded-[6px] bg-surface" />
        <div className="mt-7 h-11 w-32 animate-pulse rounded-[6px] bg-surface" />
      </div>
    </div>
  );
}
