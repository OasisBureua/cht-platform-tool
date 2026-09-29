import { useCallback, useEffect, useMemo, useRef, useState, type ImgHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import { Headphones, PlayCircle } from 'lucide-react';

/**
 * The split feature card from the dashboard, as a carousel: poster on the
 * left, eyebrow, title, lede and two actions on the right. Used by the
 * dashboard's Featured and the podcast hub's Featured episodes.
 *
 * It advances every eight seconds unless the viewer prefers reduced
 * motion, swipes on touch, and keeps the off-screen slides inert so their
 * links stay out of the tab order.
 */
export type FeatureSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string;
  /** `contain` for square cover art that shouldn't be cropped. */
  imageFit?: 'cover' | 'contain';
  primaryHref: string;
  primaryCta: string;
  primaryIcon?: 'play' | 'listen';
  secondaryHref: string;
  secondaryCta: string;
  /** Passed back through `onImageError` so the owner can drop the slide. */
  thumbTrackKey?: string;
};

export function FeatureCarousel({
  slides,
  label,
  onImageError,
}: {
  slides: FeatureSlide[];
  label: string;
  onImageError?: (thumbTrackKey: string) => void;
}) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const idKey = useMemo(() => slides.map((s) => s.id).join('|'), [slides]);

  // A different set of slides starts again from the first.
  const [seenKey, setSeenKey] = useState(idKey);
  if (seenKey !== idKey) {
    setSeenKey(idKey);
    setIndex(0);
  }
  const current = n === 0 ? 0 : Math.min(index, n - 1);

  const prev = useCallback(() => setIndex((i) => (n <= 0 ? 0 : (i - 1 + n) % n)), [n]);
  const next = useCallback(() => setIndex((i) => (n <= 0 ? 0 : (i + 1) % n)), [n]);

  useEffect(() => {
    if (n <= 1) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const t = window.setInterval(next, 8000);
    return () => window.clearInterval(t);
  }, [n, next]);

  const onImgError = useCallback<NonNullable<ImgHTMLAttributes<HTMLImageElement>['onError']>>(
    (e) => {
      const key = e.currentTarget.getAttribute('data-thumb-track');
      if (key) onImageError?.(key);
    },
    [onImageError],
  );

  if (n === 0) return null;

  return (
    <div className="relative isolate">
      <div
        className="overflow-hidden rounded-card bg-surface shadow-card"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || n <= 1) {
            touchStartX.current = null;
            return;
          }
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (dx > 60) prev();
          else if (dx < -60) next();
        }}
      >
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
          style={{
            width: `${n * 100}%`,
            transform: n <= 1 ? 'translateX(0)' : `translateX(-${(current / n) * 100}%)`,
          }}
        >
          {slides.map((slide, i) => {
            const PrimaryIcon = slide.primaryIcon === 'listen' ? Headphones : PlayCircle;
            return (
              <div
                key={slide.id}
                className="relative shrink-0 p-3 sm:p-4"
                style={{ width: `${100 / n}%` }}
                inert={i !== current ? true : undefined}
              >
                <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-8">
                  <div className="relative aspect-video overflow-hidden rounded-[10px] bg-surface-2">
                    <img
                      src={slide.imageUrl}
                      alt=""
                      data-thumb-track={slide.thumbTrackKey ?? undefined}
                      className={[
                        'absolute inset-0 h-full w-full',
                        slide.imageFit === 'contain' ? 'object-contain object-center p-4' : 'object-cover object-center',
                      ].join(' ')}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      draggable={false}
                      onError={slide.thumbTrackKey ? onImgError : undefined}
                    />
                    <div className="img-ring absolute inset-0 rounded-[inherit]" />
                  </div>
                  <div className="min-w-0 px-1 pb-2 md:px-0 md:pb-0 md:pr-6">
                    <p className="eyebrow text-anchor">{slide.eyebrow}</p>
                    <h3 className="display mt-2 line-clamp-3 text-display-s text-text">{slide.title}</h3>
                    <p className="prose-lede mt-2 line-clamp-3 max-w-lg text-body-s text-muted2">{slide.description}</p>
                    <div className="mt-5 flex flex-wrap items-center gap-2.5">
                      <Link
                        to={slide.primaryHref}
                        className="press inline-flex h-10 min-w-[44px] items-center justify-center gap-2 rounded-[8px] bg-anchor px-4 text-body-s font-medium text-ground shadow-card transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <PrimaryIcon className="h-4 w-4" aria-hidden />
                        {slide.primaryCta}
                      </Link>
                      <Link
                        to={slide.secondaryHref}
                        className="press inline-flex h-10 min-w-[44px] items-center justify-center rounded-[8px] bg-surface px-4 text-body-s font-medium text-text ring-1 ring-hairline-strong transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {slide.secondaryCta}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {n > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2" role="tablist" aria-label={label}>
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              aria-label={`Show ${s.eyebrow}: ${s.title}`}
              onClick={() => setIndex(i)}
              className={[
                'h-2 rounded-full transition-[width,background-color] duration-300',
                i === current ? 'w-8 bg-anchor' : 'w-2 bg-faint/40',
              ].join(' ')}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
