import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SegmentedControl } from '../ui';

/**
 * Three format sections folded into one, as tabs.
 *
 * Order C's whole idea: "Now on CHM", the podcast network and recent
 * articles are three answers to the same question, so they become one
 * section with a format filter rather than three consecutive scrolls.
 *
 * The panel bodies are the existing sections' own content, passed in
 * unchanged — nothing here re-implements a card. The control itself is
 * the shared SegmentedControl, so this reads the same as the catalogue
 * and the podcast series tabs.
 */

type Track = {
  key: string;
  label: string;
  panel: ReactNode;
  /** Where the rest of this format lives. */
  more?: { to: string; label: string };
};

export function LatestTabs({ tracks }: { tracks: Track[] }) {
  const [active, setActive] = useState(0);
  const uid = useId();

  return (
    <div className="mt-8">
      {/* The link sits on the tab row, not under the panel. Under a
          horizontal scroller it is only reachable by scrolling past
          everything it is offering to replace. */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedControl
          label="Latest by format"
          segments={tracks.map((t) => ({ value: t.key, label: t.label }))}
          value={tracks[active].key}
          onChange={(next) => setActive(tracks.findIndex((t) => t.key === next))}
          panelId={(v) => `${uid}-panel-${v}`}
        />

        {tracks[active].more && (
          <Link
            to={tracks[active].more!.to}
            className="press inline-flex h-9 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-4 text-body-s text-dim shadow-card hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor"
          >
            {tracks[active].more!.label}
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
          tabIndex={0}
          hidden={i !== active}
          className="mt-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
