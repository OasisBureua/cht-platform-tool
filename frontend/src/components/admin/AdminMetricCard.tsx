import type { ReactNode } from 'react';

export type AdminMetricCardVariant = 'default' | 'danger' | 'success' | 'brand';

const VARIANT_STYLES: Record<
  AdminMetricCardVariant,
  { shell: string; label: string; value: string; sub: string }
> = {
  default: {
    shell: 'border-border bg-card',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    sub: 'text-muted-foreground',
  },
  danger: {
    shell: 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30',
    label: 'text-red-700 dark:text-red-300',
    value: 'text-red-900 dark:text-red-100',
    sub: 'text-red-700 dark:text-red-300',
  },
  success: {
    shell:
      'border-green-200 bg-green-50/80 dark:border-green-900/50 dark:bg-green-950/25',
    label: 'text-green-800 dark:text-green-300',
    value: 'text-green-950 dark:text-green-100',
    sub: 'text-green-800 dark:text-green-300',
  },
  brand: {
    shell:
      'border-brand-200/80 bg-gradient-to-br from-brand-50/90 to-white dark:border-brand-900/50 dark:from-brand-950/40 dark:to-zinc-900',
    label: 'text-brand-800 dark:text-brand-200',
    value: 'text-gray-900 dark:text-zinc-50',
    sub: 'text-brand-700/80 dark:text-brand-300/80',
  },
};

export interface AdminMetricCardProps {
  label: string;
  value: string;
  sub?: string;
  variant?: AdminMetricCardVariant;
  icon?: ReactNode;
  className?: string;
}

/** Reusable admin KPI tile (Payments / Survey analytics / Campaigns dashboards). */
export function AdminMetricCard({
  label,
  value,
  sub,
  variant = 'default',
  icon,
  className = '',
}: AdminMetricCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <div
      className={[
        'rounded-card border p-4 sm:p-5',
        styles.shell,
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={['text-xs font-semibold uppercase tracking-wide', styles.label].join(' ')}>
            {label}
          </p>
          <p className={['mt-2 text-2xl font-bold tabular-nums sm:text-3xl', styles.value].join(' ')}>
            {value}
          </p>
          {sub ? (
            <p className={['mt-1 text-sm', styles.sub].join(' ')}>{sub}</p>
          ) : null}
        </div>
        {icon ? (
          <div className="shrink-0 opacity-90" aria-hidden>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
