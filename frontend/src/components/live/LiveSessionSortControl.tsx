import {
  LIVE_SESSION_SORT_OPTIONS,
  liveSessionSortLabel,
  type LiveSessionSortKey,
} from '../../utils/live-session-list-sort';

type Props = {
  sortKey: LiveSessionSortKey;
  onChange: (key: LiveSessionSortKey) => void;
  /** When false, hide “Program / topic” (participant lists without sponsor). */
  includeTopic?: boolean;
  className?: string;
  /** Desktop button-group style (participant card lists). */
  variant?: 'select' | 'buttons';
};

/**
 * Sort control for live session lists.
 * Default: labeled `<select>` (mobile-friendly). `buttons` shows a compact
 * button group suited to desktop card lists.
 */
export function LiveSessionSortControl({
  sortKey,
  onChange,
  includeTopic = true,
  className = '',
  variant = 'select',
}: Props) {
  const options = includeTopic
    ? LIVE_SESSION_SORT_OPTIONS
    : LIVE_SESSION_SORT_OPTIONS.filter((o) => o.value !== 'topic_asc');

  if (variant === 'buttons') {
    return (
      <div
        className={['flex flex-wrap items-center gap-2', className].join(' ')}
        role="group"
        aria-label="Sort sessions"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sort
        </span>
        <div className="flex flex-wrap gap-1">
          {options.map((o) => {
            const active = o.value === sortKey;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                aria-pressed={active}
                className={[
                  'rounded-[6px] px-2.5 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-gray-900 text-white'
                    : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                ].join(' ')}
              >
                {shortLabel(o.value)}
              </button>
            );
          })}
        </div>
        <span className="sr-only">Current sort: {liveSessionSortLabel(sortKey)}</span>
      </div>
    );
  }

  return (
    <label
      className={['flex flex-wrap items-center gap-2', className].join(' ')}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sort
      </span>
      <select
        value={sortKey}
        onChange={(e) => onChange(e.target.value as LiveSessionSortKey)}
        className="h-9 min-w-[12rem] rounded-[6px] border border-border bg-card px-2.5 text-sm text-foreground"
        aria-label="Sort sessions"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function shortLabel(key: LiveSessionSortKey): string {
  switch (key) {
    case 'date_asc':
      return 'Soonest';
    case 'date_desc':
      return 'Latest';
    case 'title_asc':
      return 'Title A–Z';
    case 'topic_asc':
      return 'Topic';
    case 'status':
      return 'Status';
    default:
      return key;
  }
}
