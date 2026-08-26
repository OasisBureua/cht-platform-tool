"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mark } from "./mark";
import { Thumb } from "./ui";

/* Small in-card mocks: each one shows what the format actually
 looks like inside CHM rather than describing it. */

export function ChatMock() {
 const lines = [
 { who: "a", text: "First line, HER2+, visceral disease. Where do you start?" },
 { who: "b", text: "THP still, unless the burden is high. Then I am reaching for the ADC." },
 { who: "a", text: "That is the disagreement. DB11 moved me; it has not moved you." },
 ];
 return (
 <div className="flex h-full flex-col justify-center gap-2.5 p-5">
 {lines.map((l, i) => (
 <p
 key={i}
 className={`max-w-[85%] rounded-[6px] px-3.5 py-2.5 text-[0.8125rem] leading-relaxed ${
 l.who === "a"
 ? "self-end bg-surface-2 text-dim"
 : "self-start bg-surface-2 text-muted"
 }`}
 >
 {l.text}
 </p>
 ))}
 </div>
 );
}

export function WaveMock() {
 const [tick, setTick] = useState(0);
 useEffect(() => {
 const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if (reduce) return;
 const id = setInterval(() => setTick((t) => t + 1), 220);
 return () => clearInterval(id);
 }, []);
 const bars = Array.from({ length: 34 }, (_, i) => 22 + Math.abs(Math.sin(i * 0.7 + tick * 0.35)) * 72);
 return (
 <div className="flex h-full flex-col justify-between gap-4 p-5">
 {/* Explicit height: the bars are sized in % of this row. */}
 <div className="flex h-28 items-end gap-[3px]" aria-hidden>
 {bars.map((h, i) => (
 <span
 key={i}
 style={{ height: `${h}%` }}
 className="w-full rounded-[6px] bg-accent/45 transition-[height] duration-200 ease-[var(--ease-standard)]"
 />
 ))}
 </div>
 <div className="flex items-center justify-between">
 <span className="text-[0.8125rem] text-dim">ILD monitoring in practice</span>
 <span className="meta text-faint">34:02</span>
 </div>
 </div>
 );
}

export function ReadMock() {
 return (
 <div className="flex h-full flex-col justify-center p-5">
 <p className="eyebrow text-amber-ink">6 min read</p>
 <p className="display mt-3 text-body-l text-text">What DB11 changes first-line</p>
 <div className="mt-4 space-y-2" aria-hidden>
 {[100, 96, 88, 92, 54].map((w, i) => (
 <span key={i} style={{ width: `${w}%` }} className="block h-[7px] rounded-[6px] bg-white/[0.07]" />
 ))}
 </div>
 </div>
 );
}

/* The stat band's grid: faint rules that pulse along their
 length on staggered, non-repeating durations. */
export function StatGrid() {
 const cols = 12;
 const rows = 5;
 return (
 <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
 {Array.from({ length: cols }, (_, i) => (
 <span
 key={`c${i}`}
 className="absolute top-0 bottom-0 w-px bg-white/[0.07] motion-safe:animate-[gridShimmer_var(--d)_linear_infinite]"
 style={{ left: `${((i + 1) / (cols + 1)) * 100}%`, ["--d" as string]: `${2 + ((i * 7) % 9) / 10}s` }}
 />
 ))}
 {Array.from({ length: rows }, (_, i) => (
 <span
 key={`r${i}`}
 className="absolute inset-x-0 h-px bg-white/[0.07] motion-safe:animate-[gridShimmer_var(--d)_linear_infinite]"
 style={{ top: `${((i + 1) / (rows + 1)) * 100}%`, ["--d" as string]: `${2.1 + ((i * 5) % 8) / 10}s` }}
 />
 ))}
 <span className="absolute inset-x-[18%] top-[33%] h-px bg-gradient-to-r from-transparent via-signature/50 to-transparent" />
 <span className="absolute inset-x-[30%] top-[66%] h-px bg-gradient-to-r from-transparent via-amber/40 to-transparent" />
 <Mark className="absolute -end-16 -bottom-16 size-40 text-white/[0.04]" />
 </div>
 );
}

/* ── session widget ──────────────────────────────────────
 The format row is a real APG tablist: picking a format
 swaps the artwork, the runtime and the breakdown beneath
 it, so the "one conversation, every format" claim is
 demonstrated rather than asserted. */

type Track = {
 key: string;
 label: string;
 runtime: string;
 crumb: string;
 thumb: string;
 headingLabel: string;
 rows: [string, string][];
};

const TRACKS: Track[] = [
 {
 key: "video",
 label: "Video",
 runtime: "18:40",
 crumb: "breast / her2-positive",
 thumb: "/img/thumb-cleopatra.jpg",
 headingLabel: "Chapters",
 rows: [
 ["00:00", "The case"],
 ["03:12", "What the registrational data says"],
 ["08:40", "Where the guidelines lag"],
 ["13:05", "Toxicity and dose decisions"],
 ],
 },
 {
 key: "podcast",
 label: "Podcast",
 runtime: "34:02",
 crumb: "breast / audio cut",
 thumb: "/img/thumb-ild.jpg",
 headingLabel: "Segments",
 rows: [
 ["00:00", "Cold open: the referral that started it"],
 ["05:48", "Reading DB11 without the headline"],
 ["17:22", "Monitoring in a community practice"],
 ["28:10", "What we would do Monday"],
 ],
 },
 {
 key: "editorial",
 label: "Editorial",
 runtime: "6 min",
 crumb: "breast / written explainer",
 thumb: "/img/thumb-db09.jpg",
 headingLabel: "Sections",
 rows: [
 ["01", "What the trial actually measured"],
 ["02", "The three questions that decide it"],
 ["03", "Where this leaves first line"],
 ["04", "What we are still waiting on"],
 ],
 },
 {
 key: "clips",
 label: "Clips",
 runtime: "0:45",
 crumb: "breast / short form",
 thumb: "/img/thumb-patina.jpg",
 headingLabel: "Cuts",
 rows: [
 ["0:45", "“The guidelines have not caught up.”"],
 ["0:38", "One slide on ILD monitoring"],
 ["1:02", "Dose reduction, in practice"],
 ["0:52", "Where we disagree"],
 ],
 },
];

export function SessionWidget() {
  const [active, setActive] = useState("video");
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const track = TRACKS.find((t) => t.key === active)!;
  const index = TRACKS.findIndex((t) => t.key === active);

  const move = (next: number) => {
    const i = (next + TRACKS.length) % TRACKS.length;
    setActive(TRACKS[i].key);
    tabsRef.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: TRACKS.length - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    move(next);
  };

  return (
    <div className="rounded-[6px] bg-surface p-2.5 shadow-[var(--shadow-card)]">
      {/* Window chrome, then the tab row, then the sheet: the same
          stack a browser uses, so the selected tab reads as the
          document in front rather than a button above a box. */}
      <div className="flex items-center gap-2 px-2 pt-1 pb-3">
        <span aria-hidden className="size-2.5 rounded-full bg-white/15" />
        <span aria-hidden className="size-2.5 rounded-full bg-white/15" />
        <span aria-hidden className="size-2.5 rounded-full bg-white/15" />
        <span className="meta ms-2 truncate text-faint">{track.crumb}</span>
      </div>

      <div
        role="tablist"
        aria-label="Format"
        onKeyDown={onKeyDown}
        className="relative z-10 flex gap-1"
      >
        {TRACKS.map((t, i) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={`relative flex-1 rounded-t-[8px] px-3 pt-2.5 text-[0.8125rem] transition-[background-color,color] duration-150 ease-[var(--ease-standard)] ${
                selected
                  ? "-mb-2 bg-ground pb-4 font-medium text-text"
                  : "pb-2.5 text-muted hover:bg-ground/60 hover:text-text"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${track.key}`}
        tabIndex={-1}
        className="outline-none"
      >
        <div className="relative rounded-[6px] bg-ground p-3">
          <Thumb
            key={track.key}
            src={track.thumb}
            duration={track.runtime}
            className="aspect-video w-full motion-safe:animate-[fadeSlideUp_260ms_var(--ease-out-soft)_both]"
            rounded="rounded-[6px]"
          />

          <h3 className="sr-only">{track.headingLabel}</h3>
          {/* Capped and scrollable, so a long breakdown never pushes
              the section past a single screen. */}
          <ol className="scrollbar-none mt-2 max-h-[8.5rem] overflow-y-auto overscroll-contain px-1">
            {track.rows.map(([t, label], i) => (
              <li
                key={track.key + t}
                className="flex items-center gap-3 py-1.5 motion-safe:animate-[fadeSlideUp_260ms_var(--ease-out-soft)_both]"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="meta w-12 shrink-0 tabular-nums text-anchor">{t}</span>
                <span className={`truncate text-[0.8125rem] ${i === 0 ? "text-text" : "text-muted"}`}>
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
