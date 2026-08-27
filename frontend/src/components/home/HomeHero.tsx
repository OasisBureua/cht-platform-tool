import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { DiseaseMap } from './DiseaseMap';
import { KnowledgeField } from './KnowledgeField';
import { LiveDemo } from './LiveDemo';

type Tile = { id: string; imageUrl: string };

/** Which hero this page runs. See the note on `HomeHero` below. */
export type HeroVariant = 'rail' | 'field' | 'demo';

/**
 * The landing hero. A continuous rail of real session thumbnails sits
 * behind the copy, bent through a lens so it reads as a curved surface
 * rather than a flat filmstrip.
 *
 * The rail is decorative: aria-hidden, no tab stops, no pointer events.
 * The lens is pure scale and never goes above 1, because a tile scaled
 * past its neighbours against a fixed gap laps them.
 *
 * The hero sits on the page ground rather than a pinned dark panel: the
 * scrims are `--color-ground`, so the whole composition follows the
 * appearance and the copy can use the page's own text ramp.
 *
 * Three variants, because the two homepages make different arguments:
 *   rail  — the thumbnail lens above. A shelf of content.
 *   field — a drifting particle field. Says "a body of knowledge",
 *           claims nothing specific, and carries no image licensing.
 *   demo  — the real search box over the disease map. Says "here is
 *           what the library knows, and here is the way in", and can
 *           actually be used. The map punches its own hole for the
 *           box, so the two never fight.
 */
export function HomeHero({
  tiles,
  variant = 'rail',
}: {
  tiles: Tile[];
  variant?: HeroVariant;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const row = variant === 'rail' && tiles.length ? [...tiles, ...tiles, ...tiles].slice(0, 18) : [];

  useEffect(() => {
    const root = stage.current;
    if (!root || row.length === 0) return;

    const lanes = [...root.querySelectorAll<HTMLElement>('[data-lane]')].map((lane) => ({
      lane,
      tiles: [...lane.querySelectorAll<HTMLElement>('[data-tile]')].map((el) => ({
        el,
        mid: el.offsetLeft + el.offsetWidth / 2,
      })),
    }));

    const bend = () => {
      const half = window.innerWidth / 2;
      // Below 900 barely one tile spans the viewport, so ease the bend off.
      const strength = Math.min(1, Math.max(0.3, window.innerWidth / 900));
      for (const { lane, tiles: ts } of lanes) {
        const laneLeft = lane.getBoundingClientRect().left;
        for (const { el, mid } of ts) {
          const d = Math.max(-1.6, Math.min(1.6, (laneLeft + mid - half) / half));
          const lens = Math.max(0, 1 - d * d);
          const k = 0.82 + 0.18 * lens;
          el.style.transform = `translateY(${(-10 * lens * strength).toFixed(1)}px) scale(${(1 - (1 - k) * strength).toFixed(3)})`;
          el.style.opacity = (0.2 + 0.8 * lens).toFixed(3);
        }
      }
    };

    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
      bend();
      return;
    }
    let frame = requestAnimationFrame(function loop() {
      bend();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [row.length]);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-ground"
    >
      {row.length > 0 && (
        <div
          aria-hidden
          ref={stage}
          className="pointer-events-none absolute inset-0 select-none"
        >
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-4">
            {[0, 1, 2].map((lane) => (
              <div
                key={lane}
                data-lane
                className="flex w-max gap-5 motion-safe:animate-[home-marquee_var(--dur)_linear_infinite]"
                style={{
                  ['--dur' as string]: lane === 0 ? '64s' : lane === 1 ? '82s' : '71s',
                  animationDirection: lane % 2 === 1 ? 'reverse' : 'normal',
                }}
              >
                {[...row, ...row].map((t, i) => (
                  <span
                    key={`${lane}-${t.id}-${i}`}
                    data-tile
                    className="relative block h-[9.5rem] w-[16.5rem] shrink-0 overflow-hidden rounded-[6px] bg-surface will-change-transform"
                  >
                    <img src={t.imageUrl} alt="" className="size-full object-cover" />
                  </span>
                ))}
              </div>
            ))}
          </div>
          {/* A light vignette, not a curtain: the rail should still read. */}
          <div className="absolute inset-0 bg-gradient-to-b from-ground/35 via-ground/10 to-ground" />
          <div className="absolute inset-0 bg-gradient-to-r from-ground via-ground/10 to-ground" />
          {/* One cool raking light instead of a spectrum sweep. */}
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'linear-gradient(104deg, transparent 30%, color-mix(in oklab, var(--color-blue) 20%, transparent) 46%, color-mix(in oklab, var(--color-cyan) 14%, transparent) 56%, transparent 72%)',
            }}
          />
          {/* A tight scrim directly behind the copy, and nowhere else. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(44% 38% at 50% 46%, var(--color-ground) 50%, color-mix(in oklab, var(--color-ground) 70%, transparent) 72%, transparent 100%)',
            }}
          />
        </div>
      )}

      {variant === 'demo' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
          <DiseaseMap />
          {/* Carries the contrast for the copy, so the map underneath can
              stay a map instead of being cut into an annulus. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(32% 34% at 50% 50%, var(--color-ground) 30%, color-mix(in oklab, var(--color-ground) 70%, transparent) 66%, transparent 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-ground" />
        </div>
      )}

      {variant === 'field' && (
        <div aria-hidden className="pointer-events-none absolute inset-0 select-none">
          <KnowledgeField />
          {/* A light knock-down behind the copy, not a hole: the field is
              densest dead centre, which is exactly where a hard scrim
              would leave a bare ring. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(34% 30% at 50% 44%, color-mix(in oklab, var(--color-ground) 82%, transparent) 0%, color-mix(in oklab, var(--color-ground) 40%, transparent) 62%, transparent 100%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-ground" />
        </div>
      )}

      <div className={`rail relative flex flex-col items-center justify-center pt-10 pb-16 text-center md:pt-14 md:pb-20 ${
          // The map needs an annulus around the copy to live in. On a
          // short hero the copy column eats the full width and the
          // clusters can only clip off the edges.
          variant === 'demo' ? 'md:min-h-[34rem]' : ''
        }`}>
        <h1
          id="hero-heading"
          className="rise display max-w-[16ch] text-[2.75rem] leading-[1.03] tracking-[-0.032em] text-text sm:text-[3.5rem] lg:text-[4.25rem]"
        >
          {/* The shimmer is gone: it read against a still hero, but both
              live variants now animate behind the headline, and a
              travelling highlight over a moving field just gets lost. */}
          Medicine moves through shared knowledge.
        </h1>

        <p
          className="rise prose-lede mt-7 max-w-[70ch] text-body-l text-muted2"
          style={{ animationDelay: '100ms' }}
        >
          Expert video, podcasts and editorial for oncology, organised by disease state and by
          format, so you can browse the way you actually work.
        </p>

        <div
          className="rise mt-10 flex w-full flex-wrap justify-center gap-3"
          style={{ animationDelay: '200ms' }}
        >
          {variant === 'demo' && <LiveDemo />}
          {variant !== 'demo' && (
          <><Link
            to="/join"
            className="press inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-cta ps-6 pe-5 font-mono text-[0.875rem] tracking-[-0.011em] text-ground hover:bg-cta-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Start watching free
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="size-4 shrink-0"
            >
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </Link>
          <Link
            to="/contact"
            className="press inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-surface px-6 font-mono text-[0.875rem] tracking-[-0.011em] text-text shadow-card hover:bg-ground hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Partner with CHM
          </Link></>
          )}
        </div>
      </div>
    </section>
  );
}
