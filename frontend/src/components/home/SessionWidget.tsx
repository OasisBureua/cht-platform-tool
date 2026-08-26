import { useEffect, useId, useRef, useState } from 'react';
import { Thumb } from '../ui';

/**
 * The session window: one recording seen three ways.
 *
 * These were static spans before — a picture of tabs, with the first one
 * hardcoded active, so clicking did nothing. They are real tabs now,
 * following the APG pattern: roving tabindex, arrow keys, Home/End, and
 * one tabbable stop for the whole set.
 *
 * Clips is gone. Three formats that each look genuinely different make
 * the "one recording, many formats" argument better than four where two
 * are variations on a grid of stills.
 */

type TrackKey = 'video' | 'podcast' | 'editorial';

const CHAPTERS: [string, string][] = [
  ['00:00', 'The case'],
  ['03:12', 'What the registrational data says'],
  ['08:40', 'Where the guidelines lag'],
  ['13:05', 'Toxicity and dose decisions'],
];

const ARTICLE = [
  'Recurrence remains a clinically important challenge in high-risk HER2-positive early breast cancer.',
  'Trastuzumab-based therapy improved long-term survival, but some patients still recur after standard adjuvant treatment — particularly those with hormone receptor-positive disease.',
  'Extended adjuvant therapy was designed for exactly that gap: sustained intracellular inhibition after standard therapy completes.',
  'The absolute benefit concentrates in patients who begin within a year of finishing trastuzumab, and in those who carry residual disease after neoadjuvant treatment.',
  'What changed over the past decade was not the drug. It was the understanding of how, and in whom, to use it.',
];

const TRACKS: { key: TrackKey; label: string; crumb: string; meta: string }[] = [
  { key: 'video', label: 'Video', crumb: 'breast / her2-positive', meta: '18:40' },
  { key: 'podcast', label: 'Podcast', crumb: 'breast / audio cut', meta: '34:02' },
  { key: 'editorial', label: 'Editorial', crumb: 'breast / written explainer', meta: '6 min' },
];

export function SessionWidget({ poster }: { poster: string }) {
  const [active, setActive] = useState<TrackKey>('video');
  const uid = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = TRACKS.findIndex((t) => t.key === active);
  const track = TRACKS[index];

  const move = (next: number) => {
    const i = (next + TRACKS.length) % TRACKS.length;
    setActive(TRACKS[i].key);
    tabRefs.current[i]?.focus();
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
    <div className="rounded-[6px] bg-surface p-2.5 shadow-card">
      {/* Window chrome, then the tab row, then the sheet: the stack a
          browser uses, so the selected tab reads as the document in
          front rather than a button above a box. */}
      <div className="flex items-center gap-2 px-2 pt-1 pb-3">
        <span aria-hidden className="size-2.5 rounded-full bg-hairline-strong" />
        <span aria-hidden className="size-2.5 rounded-full bg-hairline-strong" />
        <span aria-hidden className="size-2.5 rounded-full bg-hairline-strong" />
        <span className="meta ms-2 truncate text-faint">{track.crumb}</span>
      </div>

      <div role="tablist" aria-label="Session formats" onKeyDown={onKeyDown} className="relative z-10 flex gap-1">
        {TRACKS.map((t, i) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              type="button"
              id={`${uid}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${uid}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.key)}
              className={`relative flex-1 rounded-t-[8px] px-3 pt-2.5 text-center text-[0.8125rem] transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor ${
                selected
                  ? '-mb-2 bg-ground pb-4 font-medium text-text'
                  : 'pb-2.5 text-muted2 hover:text-text'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${uid}-panel-${track.key}`}
        aria-labelledby={`${uid}-tab-${track.key}`}
        tabIndex={0}
        className="relative rounded-[6px] bg-ground p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor"
      >
        {active === 'video' && <VideoTrack poster={poster} meta={track.meta} />}
        {active === 'podcast' && <PodcastTrack meta={track.meta} />}
        {active === 'editorial' && <EditorialTrack meta={track.meta} />}
      </div>
    </div>
  );
}

function VideoTrack({ poster, meta }: { poster: string; meta: string }) {
  return (
    <>
      <Thumb src={poster} duration={meta} className="aspect-video w-full" />
      <h3 className="sr-only">Chapters</h3>
      <ol className="scrollbar-none mt-2 max-h-[8.5rem] overflow-y-auto overscroll-contain px-1">
        {CHAPTERS.map(([t, label], i) => (
          <li key={t} className="flex items-center gap-3 py-1.5">
            <span className="meta w-12 shrink-0 tabular-nums text-anchor">{t}</span>
            <span className={`truncate text-[0.8125rem] ${i === 0 ? 'text-text' : 'text-muted2'}`}>
              {label}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** The audio cut. The same curve the rest of the site uses for a wave. */
function PodcastTrack({ meta }: { meta: string }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 220);
    return () => window.clearInterval(id);
  }, []);

  const bars = Array.from(
    { length: 34 },
    (_, i) => 22 + Math.abs(Math.sin(i * 0.7 + tick * 0.35)) * 72,
  );

  return (
    <div className="flex h-[15.5rem] flex-col justify-between p-2">
      <div className="flex h-32 items-end gap-[3px]" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h}%` }}
            className="w-full rounded-[6px] bg-amber/45 transition-[height] duration-200 ease-out"
          />
        ))}
      </div>
      <div>
        <p className="text-[0.8125rem] text-dim">The same conversation, as an audio cut</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="meta text-faint">Listen anywhere</span>
          <span className="meta tabular-nums text-faint">{meta}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The written explainer, reading itself. A slow upward drift under a
 * fade at both edges, so the panel shows that the same session exists
 * as prose without asking anyone to actually read it here.
 */
function EditorialTrack({ meta }: { meta: string }) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  return (
    <div className="flex h-[15.5rem] flex-col p-2">
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 78%, transparent)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, black 12%, black 78%, transparent)',
        }}
      >
        <div
          className={reduced ? '' : 'motion-safe:animate-[editorial-drift_26s_linear_infinite]'}
          aria-hidden={!reduced}
        >
          {[0, 1].map((pass) => (
            <div key={pass}>
              {ARTICLE.map((line, i) => (
                <p
                  key={`${pass}-${i}`}
                  className="px-1 pb-3 text-[0.8125rem] leading-relaxed text-muted2"
                >
                  {line}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="meta text-faint">Neratinib revisited</span>
        <span className="meta tabular-nums text-faint">{meta}</span>
      </div>
    </div>
  );
}
