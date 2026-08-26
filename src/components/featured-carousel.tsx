"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { facultyBySlug, formatHref, type Item } from "@/lib/data";
import { HeroPanel } from "./hero-panels";
import { ArrowRight, PlayIcon } from "./icons";
import { Thumb } from "./ui";

/**
 * Featured video carousel: three items, auto-advancing, with dots to
 * jump. Advancing pauses on hover and under reduced motion, and each
 * slide is a real link so the featured item is always reachable.
 */
export function FeaturedCarousel({ items }: { items: Item[] }) {
  const slides = items.slice(0, 3);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [paused, slides.length]);

  const active = slides[i];
  const lead = facultyBySlug(active.faculty[0]);

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <HeroPanel>
        <div className="p-3">
          <Link
            href={formatHref(active)}
            className="press group block"
            aria-label={`Featured: ${active.title}`}
          >
            <span className="relative block">
              <Thumb
                key={active.slug}
                src={active.thumb}
                duration={active.duration}
                className="aspect-video w-full motion-safe:animate-[fadeSlideUp_320ms_var(--ease-out-soft)_both]"
                rounded="rounded-[6px]"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-14 place-items-center rounded-[6px] bg-ground/90 text-anchor shadow-[var(--shadow-card)] transition-[scale] duration-150 ease-[var(--ease-standard)] group-hover:scale-105">
                  <PlayIcon className="size-6" />
                </span>
              </span>
            </span>

            <span className="mt-4 block px-1">
              <span className="eyebrow text-amber-ink">Featured · {i + 1} of {slides.length}</span>
              <span className="display mt-2 block text-body-l text-text group-hover:text-anchor">
                {active.title}
              </span>
              <span className="meta mt-2 flex items-center gap-2 text-faint">
                {lead?.name}
                <ArrowRight
                  className="size-3.5 transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1"
                  strokeWidth={1.75}
                />
              </span>
            </span>
          </Link>

          <div className="mt-4 flex gap-2 px-1 pb-1">
            {slides.map((s, n) => (
              <button
                key={s.slug}
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show featured video ${n + 1}: ${s.title}`}
                aria-current={n === i}
                className="press -my-2.5 flex h-6 flex-1 items-center py-2.5"
              >
                <span
                  aria-hidden
                  className="block h-1.5 w-full rounded-[6px] transition-[background-color] duration-150"
                  style={{
                    background: n === i ? "var(--color-anchor)" : "var(--color-surface-2)",
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      </HeroPanel>
    </div>
  );
}
