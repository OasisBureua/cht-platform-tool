"use client";

import Link from "next/link";
import { diseaseAreas } from "@/lib/platform";
import { ArrowRight } from "./icons";

/**
 * Disease states as solid pills in a rail that slides horizontally.
 * The colour lives in the fill, not in a marker beside the card.
 * Scroll controls sit above the rail, ahead of what they act on.
 */
export function AreaRail() {






  return (
    <div className="relative">


      {/* overflow-x-auto clips vertically too, so the hover lift needs
          headroom inside the scroller rather than margin outside it. */}
      <div className="-my-5">
        <div
          className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto py-5"
        >
          {diseaseAreas.map((a) => (
            <Link
              key={a.slug}
              href={`/catalog/${a.slug === "lung" ? "lung-cancer" : "breast-cancer"}`}
              style={{ backgroundImage: `linear-gradient(135deg, ${a.tone} 0%, color-mix(in oklab, ${a.tone} 62%, var(--color-blue)) 100%)` }}
              className="press group relative isolate flex min-w-[15rem] flex-1 snap-start items-center justify-between gap-6 overflow-hidden rounded-[6px] px-7 py-5 text-on-bright shadow-[var(--shadow-card)] transition-[translate,box-shadow] duration-200 ease-[var(--ease-out-strong)] hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]"
            >
              {/* Metallic build-up: a lit top edge, a shaded floor and
                  a sheen that sweeps across on hover. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10"
                style={{
                  background:
                    "linear-gradient(180deg, rgb(255 255 255 / 0.3) 0%, rgb(255 255 255 / 0.08) 34%, rgb(0 0 0 / 0.05) 70%, rgb(0 0 0 / 0.14) 100%)",
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px"
                style={{ background: "rgb(255 255 255 / 0.55)" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -z-10 w-1/2 -translate-x-[220%] skew-x-[-18deg] transition-transform duration-200 ease-[var(--ease-out-strong)] group-hover:translate-x-[320%] motion-reduce:hidden"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.34), transparent)",
                }}
              />

              <span>
                <span className="display block text-display-s">{a.label}</span>
                <span className="mt-0.5 block text-body-s text-on-bright/80">
                  {a.live ? "Video, podcast, editorial" : "Coming this quarter"}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1"
                strokeWidth={2}
              />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
