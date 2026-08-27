import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/**
 * The surface. Separation is carried by a surface change plus elevation
 * rather than a hairline, which is how the platform already rendered in
 * practice: 13 of 590 elements on the old home page had a border.
 *
 * Exported under the original names so every page already importing
 * Card/StatCard picks up the new treatment without a per-file change.
 */
export function Card({
  children,
  className = '',
  to,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  /** Makes the whole card a link, and turns on the hover lift. */
  to?: string;
  interactive?: boolean;
}) {
  const classes = cn(
    'rounded-card bg-card text-card-foreground shadow-card p-6',
    (interactive || to) &&
      'transition-[box-shadow,background-color,translate] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
        'hover:shadow-card-hover hover:-translate-y-0.5 motion-safe:active:scale-[0.99] ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    className,
  );
  return to ? (
    <Link to={to} className={cn('block', classes)}>
      {children}
    </Link>
  ) : (
    <div className={classes}>{children}</div>
  );
}

export function StatCard({
  title,
  value,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {/* Changing values get tabular figures so the row cannot jitter. */}
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
          {trend && <p className="mt-2 text-sm text-muted-foreground">{trend.label}</p>}
        </div>
        <div className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}
