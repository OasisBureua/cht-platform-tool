import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

type Tile = { id: string; imageUrl: string };

/**
 * The landing hero. A continuous rail of real session thumbnails sits
 * behind the copy, bent through a lens so it reads as a curved surface
 * rather than a flat filmstrip.
 *
 * The rail is decorative: aria-hidden, no tab stops, no pointer events.
 * The lens is pure scale and never goes above 1, because a tile scaled
 * past its neighbours against a fixed gap laps them.
 */
export function HomeHero({ tiles }: { tiles: Tile[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const row = tiles.length ? [...tiles, ...tiles, ...tiles].slice(0, 18) : [];

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
          el.style.opacity = (0.24 + 0.76 * lens).toFixed(3);
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
    <section className="relative isolate overflow-hidden bg-zinc-950">
      {row.length > 0 && (
        <div
          aria-hidden
          ref={stage}
          className="pointer-events-none absolute inset-0 select-none"
        >
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-4">
            {[0, 1].map((lane) => (
              <div
                key={lane}
                data-lane
                className="flex w-max gap-5 motion-safe:animate-[home-marquee_var(--dur)_linear_infinite]"
                style={{
                  ['--dur' as string]: lane === 0 ? '68s' : '86s',
                  animationDirection: lane === 1 ? 'reverse' : 'normal',
                }}
              >
                {[...row, ...row].map((t, i) => (
                  <span
                    key={`${lane}-${t.id}-${i}`}
                    data-tile
                    className="relative block h-[8.5rem] w-[15rem] shrink-0 overflow-hidden rounded-card bg-zinc-900 will-change-transform"
                  >
                    <img src={t.imageUrl} alt="" className="size-full object-cover" />
                  </span>
                ))}
              </div>
            ))}
          </div>
          {/* A vignette, not a curtain: the rail should still read. */}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/35 via-zinc-950/10 to-zinc-950" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/10 to-zinc-950" />
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                'linear-gradient(104deg, transparent 30%, hsl(var(--cerebral-blue) / 0.2) 46%, hsl(var(--cerebral-cyan) / 0.14) 56%, transparent 72%)',
            }}
          />
          {/* A tight scrim directly behind the copy, and nowhere else. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(44% 40% at 50% 50%, rgb(9 9 11) 48%, rgb(9 9 11 / 0.7) 72%, transparent 100%)',
            }}
          />
        </div>
      )}

      <div className="relative mx-auto flex min-h-[26rem] max-w-4xl flex-col items-center justify-center px-5 py-20 text-center sm:min-h-[30rem] sm:px-6">
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
          The future of healthcare marketing and education
        </h1>
        <p className="mt-5 max-w-[52ch] text-pretty leading-relaxed text-white/75">
          Community Health Technologies is redefining how pharma reaches healthcare
          audiences, and educates them where they actively consume and trust
          information.
        </p>
        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/join"
            className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-[6px] bg-brand-600 px-7 text-sm font-semibold text-white shadow-[0_8px_28px_-8px_rgba(0,124,255,0.5)] transition-[background-color,scale] duration-150 hover:bg-brand-700 motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Get started
          </Link>
          <Link
            to="/about"
            className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-[6px] bg-white/10 px-7 text-sm font-semibold text-white backdrop-blur-sm transition-[background-color,scale] duration-150 hover:bg-white/20 motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Learn more
          </Link>
        </div>
      </div>
    </section>
  );
}
