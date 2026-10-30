import { cn } from '../../../lib/cn';

export type SurveyStatusKind =
  | 'collecting'
  | 'ready'
  | 'draft'
  | 'native'
  | 'jotform'
  | 'attention'
  | 'customized';

const STYLES: Record<SurveyStatusKind, string> = {
  collecting: 'bg-brand-50 text-brand-800 ring-brand-200/80 dark:bg-brand-950/50 dark:text-brand-100 dark:ring-brand-800/50',
  ready: 'bg-success/10 text-success ring-success/25',
  draft: 'bg-muted text-muted-foreground ring-border',
  native: 'bg-cyan-50 text-cyan-900 ring-cyan-200/70 dark:bg-cyan-950/40 dark:text-cyan-100 dark:ring-cyan-800/40',
  jotform: 'bg-amber-50 text-amber-900 ring-amber-200/70 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-800/40',
  attention: 'bg-warning/15 text-warning ring-warning/30',
  customized: 'bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700',
};

export function SurveyStatusPill({
  kind,
  children,
  className,
}: {
  kind: SurveyStatusKind;
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold ring-1',
        STYLES[kind],
        className,
      )}
    >
      {children}
    </span>
  );
}
