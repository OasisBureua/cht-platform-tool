import { Link } from 'react-router-dom';
import { Play, Info } from 'lucide-react';
import type { MediaHubClip } from '../../api/catalog';
import { getShortClipId, getMediaHubThumbnail } from '../../utils/clipUrl';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';

type ConversationsHeroProps = {
  clip: MediaHubClip;
  isInApp: boolean;
};

/**
 * Replit-style featured strip: full-width image, bottom gradient, tag, title, copy, play / detail actions.
 * Tuned for light app shell: card sits on gray-50 with rounded corners and layered shadow.
 */
export function ConversationsHero({ clip, isInApp }: ConversationsHeroProps) {
  const playHref = isInApp ? `/app/clip/${getShortClipId(clip.id)}` : `/catalog/clip/${getShortClipId(clip.id)}`;
  const thumb = getMediaHubThumbnail(clip);
  const summary = clipDisplaySummary(clip);
  const body = (summary && summary.trim()) || (clip.description && clip.description.trim()) || '';
  const tag = Array.isArray(clip.tags) && clip.tags[0] ? String(clip.tags[0]) : 'Featured';
  const speakerLine = clip.doctors?.filter(Boolean).join(' · ');

  return (
    <section
      className={[
        'overflow-hidden bg-zinc-900 shadow-[0_1px_0_rgba(0,0,0,0.06),0_20px_50px_-24px_rgba(0,0,0,0.35)]',
        isInApp ? 'rounded-none' : 'rounded-2xl',
      ].join(' ')}
      aria-label="Featured video"
    >
      <div className="relative h-[min(56vh,520px)] min-h-[280px] w-full sm:min-h-[320px] md:h-[min(58vh,580px)]">
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
          draggable={false}
          referrerPolicy="no-referrer"
        />

        {/* Legibility: left and bottom scrims (Replit-style fades, light-canvas safe text). */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[60%] bg-gradient-to-r from-black/55 via-black/20 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[85%] bg-gradient-to-t from-black/75 via-black/25 to-transparent"
          aria-hidden
        />

        <div className="relative z-10 flex h-full max-w-[640px] flex-col justify-end px-4 pb-8 pt-20 sm:px-6 sm:pb-10 md:px-10 md:pt-24">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand-300">{tag}</p>
          <h2 className="mb-2 text-balance font-sans text-[26px] font-black leading-[1.08] tracking-[-0.03em] text-white md:text-[36px]">
            {clip.title}
          </h2>
          {body ? (
            <p className="mb-3 line-clamp-2 max-w-[540px] text-pretty text-sm leading-relaxed text-white/80 md:text-[15px]" title={body}>
              {body}
            </p>
          ) : null}
          {speakerLine ? <p className="mb-5 text-xs text-white/50">{speakerLine}</p> : <div className="mb-5" />}

          <div className="flex flex-wrap gap-3">
            <Link
              to={playHref}
              className="hero-play-btn inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-zinc-900 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white/95 active:scale-[0.96]"
            >
              <Play className="h-4 w-4 shrink-0" aria-hidden fill="currentColor" />
              Play
            </Link>
            <Link
              to={playHref}
              className="inline-flex h-11 min-w-[44px] items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-sm transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white/20 active:scale-[0.96]"
            >
              <Info className="h-4 w-4 shrink-0" aria-hidden />
              More detail
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ConversationsHeroSkeleton() {
  return (
    <div
      className="h-[min(56vh,520px)] min-h-[280px] overflow-hidden rounded-2xl bg-zinc-200/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)] sm:min-h-[320px] md:h-[min(58vh,580px)]"
      aria-hidden
    >
      <div className="flex h-full flex-col justify-end p-4 sm:p-6 md:px-10">
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-zinc-300/80" />
        <div className="mb-2 h-8 w-4/5 max-w-md animate-pulse rounded bg-zinc-300/80" />
        <div className="mb-2 h-3 w-full max-w-sm animate-pulse rounded bg-zinc-300/60" />
        <div className="mt-4 h-10 w-28 animate-pulse rounded-md bg-zinc-300/80" />
      </div>
    </div>
  );
}
