import { useId, useRef } from 'react';

/**
 * The site's one way to switch between views of the same thing.
 *
 * Replaces three separate patterns that had grown up independently:
 * underline tabs on the homepage, a bespoke pill group on the
 * catalogue, and folder tabs elsewhere. A segmented control is the
 * honest shape here — these are filters over one section, not
 * navigation between pages — and unlike folder tabs it needs no sheet
 * to attach to, so panels stay on the page ground instead of becoming
 * surfaces with surfaces nested inside them.
 *
 * Real APG tabs: roving tabindex, arrow keys, Home and End, and a
 * single tab stop for the whole group. Callers own the panels, so this
 * renders the control and nothing else.
 */

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** Rendered small and dimmed after the label. */
  count?: number;
};

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  label,
  panelId,
  className = '',
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Names the group for screen readers, e.g. "Latest by format". */
  label: string;
  /** When the caller renders one panel, its id, for aria-controls. */
  panelId?: (value: T) => string;
  className?: string;
}) {
  const uid = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = segments.findIndex((s) => s.value === value);

  const move = (next: number) => {
    const i = (next + segments.length) % segments.length;
    onChange(segments[i].value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number | undefined> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: segments.length - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    move(next);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`inline-flex shrink-0 gap-1 rounded-[8px] bg-surface p-1 shadow-card ${className}`}
    >
      {segments.map((s, i) => {
        const on = s.value === value;
        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${uid}-${s.value}`}
            aria-selected={on}
            aria-controls={panelId?.(s.value)}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(s.value)}
            className={`press inline-flex h-9 items-center whitespace-nowrap rounded-[6px] px-4 text-body-s transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              on ? 'bg-ground font-medium text-text shadow-card' : 'text-muted2 hover:text-text'
            }`}
          >
            {s.label}
            {s.count !== undefined ? (
              <span className="meta ms-2 tabular-nums text-faint">{s.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
