"use client";

import Link from "next/link";
import { shows } from "@/lib/platform";
import { Mark } from "./mark";
import { ArrowRight } from "./icons";

/**
 * The podcast network as a sliding rail. Each show keeps its own
 * tone, applied as a multiply wash over the cover so the network
 * reads as four distinct brands rather than one grid.
 */
export function ShowCarousel() {



  return (
    <div className="relative">

      {/* Headroom lives inside the scroller: overflow-x also clips
          vertically, which would cut off the hover lift. */}
      <div className="-my-5">
        <ul
          className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-4 overflow-x-auto py-5"
        >
          {shows.map((s) => (
            <li key={s.slug} className="w-[19rem] shrink-0 snap-start">
              <Link
                href="/chm-office-hours"
                className="press lift group flex h-full flex-col overflow-hidden rounded-[6px] bg-surface shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.cover}
                    alt=""
                    className="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.04]"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0 mix-blend-multiply"
                    style={{ background: s.tone, opacity: 0.72 }}
                  />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <Mark className="absolute bottom-3 start-3 size-6 text-white/90" />
                  {s.spanish ? (
                    <span className="eyebrow absolute top-3 end-3 rounded-[6px] bg-white/90 px-2.5 py-1 text-text">
                      Español
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="display text-body-m text-text">{s.title}</h3>
                  <p className="prose-lede mt-1 line-clamp-2 max-w-[38ch] text-body-s text-muted">{s.tagline}</p>
                  <p className="meta mt-auto pt-4 text-faint">
                    {s.episodes} episodes · {s.hosts}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
