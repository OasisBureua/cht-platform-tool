import { useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Three format sections folded into one, as tabs.
 *
 * Order C's whole idea: "Now on CHM", the podcast network and recent
 * articles are three answers to the same question, so they become one
 * section with a format filter rather than three consecutive scrolls.
 *
 * The panel bodies are the existing sections' own content, passed in
 * unchanged — nothing here re-implements a card. Real APG tabs, same
 * pattern as the session widget: roving tabindex, arrow keys, Home and
 * End, and one tab stop for the whole set.
 */

type Track = {
  key: string;
  label: string;
  /** The catalogue total, not the number of cards in the panel. */
  count?: number;
  panel: ReactNode;
  /** Where the rest of this format lives, and what to call it. */
  more?: { to: string; label: string };
};

export function LatestTabs({ tracks }: { tracks: Track[] }) {
  const [active, setActive] = useState(0);
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (next: number) => {
    const i = (next + tracks.length) % tracks.length;
    setActive(i);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number | undefined> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: tracks.length - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    move(next);
  };

  return (
    <div className="mt-8">
      {/* The link sits on the tab row, not under the panel. Under a
          horizontal scroller it is only reachable by scrolling past
          everything it is offering to replace. */}
      <div className="flex items-end justify-between gap-4 border-b border-hairline">
      <div
        role="tablist"
        aria-label="Latest by format"
        onKeyDown={onKeyDown}
        className="flex gap-1"
      >
        {tracks.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.key}
              ref={(el) => { refs.current[i] = el; }}
              role="tab"
              type="button"
              id={`${uid}-tab-${t.key}`}
              aria-controls={`${uid}-panel-${t.key}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              className={`press relative px-3 pb-3 pt-2 text-body-m transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor ${
                on ? 'font-medium text-text' : 'text-muted2 hover:text-text'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="meta ms-1.5 tabular-nums text-faint">{t.count}</span>
              )}
              {on && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-anchor"
                />
              )}
            </button>
          );
        })}
      </div>

        {tracks[active].more && (
          <Link
            to={tracks[active].more!.to}
            className="press mb-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] px-1 text-body-s text-muted2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor"
          >
            <span className="max-sm:hidden">{tracks[active].more!.label}</span>
            <span className="sm:hidden">See all</span>
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
        )}
      </div>

      {tracks.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${uid}-panel-${t.key}`}
          aria-labelledby={`${uid}-tab-${t.key}`}
          tabIndex={0}
          hidden={i !== active}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
