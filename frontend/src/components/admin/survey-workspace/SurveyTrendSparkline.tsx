import { cn } from '../../../lib/cn';

/** Compact 30-day response sparkline for the workspace KPI strip. */
export function SurveyTrendSparkline({
  points,
  className,
  label = 'Last 30 days',
}: {
  points: Array<{ date: string; count: number }>;
  className?: string;
  label?: string;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card/90 p-4 shadow-card',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {total}
          </p>
          <p className="text-xs text-muted-foreground">responses in range</p>
        </div>
      </div>
      <div
        className="mt-4 flex h-14 items-end gap-0.5"
        role="img"
        aria-label={`${total} responses over the last ${points.length} days`}
      >
        {points.map((point) => {
          const height = Math.max(4, Math.round((point.count / max) * 100));
          return (
            <div
              key={point.date}
              title={`${point.date}: ${point.count}`}
              className="min-w-0 flex-1 rounded-t-[2px] bg-brand-500/80 transition-[height] dark:bg-brand-400/70"
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
