import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

export type SurveyDeviceMode = 'desktop' | 'mobile';

/**
 * Participant preview stage. Chunk 5 will mount NativeSurveyForm inside;
 * foundation ships the chrome so Preview already looks intentional.
 */
export function SurveyDeviceFrame({
  mode,
  children,
  className,
}: {
  mode: SurveyDeviceMode;
  children: ReactNode;
  className?: string;
}) {
  if (mode === 'mobile') {
    return (
      <div className={cn('mx-auto w-full max-w-[390px]', className)}>
        <div className="overflow-hidden rounded-[1.75rem] border-[10px] border-slate-800 bg-slate-800 shadow-pop dark:border-zinc-700">
          <div className="relative bg-background">
            <div className="flex justify-center bg-slate-800 pb-2 pt-1.5" aria-hidden>
              <div className="h-1.5 w-20 rounded-full bg-slate-600" />
            </div>
            <div className="max-h-[70vh] min-h-[420px] overflow-y-auto bg-background px-3 py-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-card border border-border bg-card shadow-card',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ms-3 h-6 flex-1 rounded-[4px] bg-background/80 ring-1 ring-border" />
      </div>
      <div className="max-h-[70vh] min-h-[360px] overflow-y-auto px-6 py-5">{children}</div>
    </div>
  );
}
