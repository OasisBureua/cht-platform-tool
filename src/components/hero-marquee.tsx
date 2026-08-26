"use client";

import { useEffect, useRef } from "react";
import { items } from "@/lib/data";

/**
 * A continuous rail of thumbnails behind the hero. Decorative only:
 * aria-hidden, no tab stops, no pointer events.
 *
 * The rail is bent through a lens: tiles swell and rotate toward the
 * centre and fall away at the edges, so the strip reads as a curved
 * surface rather than a flat filmstrip. The bend is driven by one
 * rect read per lane per frame (tile offsets are measured once and
 * cached), and only `transform` is written, so it stays on the GPU.
 */
export function HeroMarquee() {
  const row = [...items, ...items].slice(0, 16);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;

    const lanes = [...root.querySelectorAll<HTMLElement>("[data-lane]")].map((lane) => ({
      lane,
      tiles: [...lane.querySelectorAll<HTMLElement>("[data-tile]")].map((el) => ({
        el,
        // Measured once: these never change, only the lane slides.
        mid: el.offsetLeft + el.offsetWidth / 2,
      })),
    }));

    const bend = () => {
      const half = window.innerWidth / 2;
      // A narrow viewport holds barely one tile across, so the full
      // bend puts a single image on its edge. Ease it off below 900.
      const strength = Math.min(1, Math.max(0.3, window.innerWidth / 900));
      for (const { lane, tiles } of lanes) {
        const laneLeft = lane.getBoundingClientRect().left;
        for (const { el, mid } of tiles) {
          // -1 at the left edge, 0 dead centre, 1 at the right edge.
          const d = Math.max(-1.6, Math.min(1.6, (laneLeft + mid - half) / half));
          const lens = Math.max(0, 1 - d * d);
// A pure scale lens, no 3D. rotateY under perspective makes the
          // near half of a tile larger, so its projected box grows wider
          // than the tile and laps its neighbour however small the angle
          // is. Scaling down about each tile's own centre can only ever
          // open the gap, so the rhythm stays even and nothing collides.
          const k = 0.82 + 0.18 * lens;
          el.style.transform = `translateY(${(-10 * lens * strength).toFixed(1)}px) scale(${(1 - (1 - k) * strength).toFixed(3)})`;
          el.style.opacity = (0.2 + 0.8 * lens).toFixed(3);
        }
      }
    };

    // Under reduced motion the marquee is paused, so one pass is enough.
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      bend();
      return;
    }

    let frame = requestAnimationFrame(function loop() {
      bend();
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-full select-none overflow-hidden"
    >
      <div
        ref={stage}
        className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col gap-4"
      >
        {[0, 1, 2].map((lane) => (
          <div
            key={lane}
            data-lane
            className="flex w-max gap-5 motion-safe:animate-[marquee_var(--dur)_linear_infinite]"
            style={{
              ["--dur" as string]: lane === 0 ? "64s" : lane === 1 ? "82s" : "71s",
              animationDirection: lane % 2 === 1 ? "reverse" : "normal",
            }}
          >
            {[...row, ...row].map((it, i) => (
              <span
                key={`${lane}-${it.slug}-${i}`}
                data-tile
                className="relative block h-[9.5rem] w-[16.5rem] shrink-0 overflow-hidden rounded-[6px] bg-surface will-change-transform"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumb} alt="" className="size-full object-cover" />
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
            "linear-gradient(104deg, transparent 30%, color-mix(in oklab, var(--color-blue) 20%, transparent) 46%, color-mix(in oklab, var(--color-cyan) 14%, transparent) 56%, transparent 72%)",
        }}
      />
      {/* A tight scrim directly behind the copy, and nowhere else. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(44% 38% at 50% 46%, var(--color-ground) 50%, color-mix(in oklab, var(--color-ground) 70%, transparent) 72%, transparent 100%)",
        }}
      />
    </div>
  );
}
