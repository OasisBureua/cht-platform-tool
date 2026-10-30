import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../../lib/cn';

export type SurveyKpiTone = 'brand' | 'cyan' | 'slate' | 'amber' | 'rose';

const TONE: Record<
  SurveyKpiTone,
  { shell: string; icon: string; label: string; ring: string }
> = {
  brand: {
    shell: 'from-brand-50/90 via-white to-white dark:from-brand-950/40 dark:via-zinc-900 dark:to-zinc-950',
    icon: 'text-brand-700 dark:text-brand-300',
    label: 'text-brand-800 dark:text-brand-200',
    ring: 'ring-brand-100/90 dark:ring-brand-900/40',
  },
  cyan: {
    shell: 'from-cyan-50/90 via-white to-white dark:from-cyan-950/35 dark:via-zinc-900 dark:to-zinc-950',
    icon: 'text-cyan-700 dark:text-cyan-300',
    label: 'text-cyan-900 dark:text-cyan-200',
    ring: 'ring-cyan-100/80 dark:ring-cyan-900/35',
  },
  slate: {
    shell: 'from-slate-50 via-white to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950',
    icon: 'text-slate-600 dark:text-zinc-300',
    label: 'text-slate-700 dark:text-zinc-300',
    ring: 'ring-slate-200/80 dark:ring-zinc-700/50',
  },
  amber: {
    shell: 'from-amber-50/90 via-white to-white dark:from-amber-950/30 dark:via-zinc-900 dark:to-zinc-950',
    icon: 'text-amber-700 dark:text-amber-300',
    label: 'text-amber-900 dark:text-amber-200',
    ring: 'ring-amber-100/80 dark:ring-amber-900/35',
  },
  rose: {
    shell: 'from-rose-50/80 via-white to-white dark:from-rose-950/25 dark:via-zinc-900 dark:to-zinc-950',
    icon: 'text-rose-700 dark:text-rose-300',
    label: 'text-rose-900 dark:text-rose-200',
    ring: 'ring-rose-100/80 dark:ring-rose-900/30',
  },
};

export function SurveyKpiTile({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  to,
  trend,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: SurveyKpiTone;
  to?: string;
  trend?: string;
  className?: string;
}) {
  const t = TONE[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        {icon ? <span className={cn('opacity-90', t.icon)}>{icon}</span> : <span />}
        {trend ? (
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground shadow-card dark:bg-zinc-800">
            {trend}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-foreground md:text-3xl">
        {value}
      </p>
      <p className={cn('mt-1 text-sm font-semibold', t.label)}>{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  const shell = cn(
    'group relative flex flex-col overflow-hidden rounded-card bg-gradient-to-br p-4 shadow-card ring-1 transition-[transform,box-shadow] duration-200',
    'motion-safe:hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    t.shell,
    t.ring,
    className,
  );

  if (to) {
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    );
  }

  return <div className={shell}>{body}</div>;
}
