import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { SurveyStatusPill } from './SurveyStatusPill';

export type SurveyAttentionItem = {
  id: string;
  title: string;
  reason: string;
  href: string;
  kind?: 'low_completion' | 'no_responses';
};

export function SurveyAttentionList({
  items,
  className,
}: {
  items: SurveyAttentionItem[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-card border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-card to-card shadow-card',
        'dark:border-amber-900/40 dark:from-amber-950/25',
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-amber-200/60 px-4 py-3 dark:border-amber-900/30">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Low completion or no responses yet — open a survey to dig in.
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          Nothing flagged right now. Nice work.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={item.href}
                className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-brand-800 dark:group-hover:text-brand-200">
                    {item.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SurveyStatusPill kind="attention">
                      {item.kind === 'low_completion' ? 'Low completion' : 'No responses'}
                    </SurveyStatusPill>
                    <span className="text-xs text-muted-foreground">{item.reason}</span>
                  </div>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5 group-hover:text-brand-700 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
