import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/**
 * Survey workspace page hero — brand-forward atmosphere for the command center.
 * Keep the first viewport calm: title, one supporting line, optional actions.
 */
export function SurveyWorkspaceHero({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-card border border-brand-200/70 bg-gradient-to-br from-brand-50 via-white to-cyan-50/40 p-5 shadow-card sm:p-6',
        'dark:border-brand-900/40 dark:from-brand-950/50 dark:via-zinc-950 dark:to-zinc-900',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-200/30 blur-3xl dark:bg-brand-700/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-cyan-200/25 blur-3xl dark:bg-cyan-800/15"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
            Survey workspace
          </p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-foreground sm:text-[15px] sm:leading-relaxed">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
