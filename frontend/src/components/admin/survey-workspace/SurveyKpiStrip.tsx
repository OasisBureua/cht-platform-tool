import type { ReactNode } from 'react';
import { cn } from '../../../lib/cn';

/** Responsive KPI row for the survey command center. */
export function SurveyKpiStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
