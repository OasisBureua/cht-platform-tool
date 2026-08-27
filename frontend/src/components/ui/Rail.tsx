import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * A horizontal scroller that runs to the viewport edge instead of being
 * clipped short of it, while its first item still lines up with the page
 * gutter. A card cut off inside the gutter reads as broken; one running
 * off the edge reads as "more that way".
 *
 * The vertical headroom lives inside the scroller because overflow-x
 * clips vertically too, which would otherwise cut off the hover lift.
 */
export function Rail({
  children,
  className,
  'aria-label': ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className="-my-4">
      <ul
        aria-label={ariaLabel}
        className={cn(
          'bleed-x flex snap-x snap-mandatory gap-4 overflow-x-auto py-4',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {children}
      </ul>
    </div>
  );
}

export function SectionHead({
  index,
  title,
  sub,
  action,
}: {
  index?: string;
  title: string;
  sub?: string;
  /** Controls sit above what they control, not below it. */
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {index && (
          /* Monospace and tabular so the index reads as a fixed-width
             marker and every section title starts at the same x. */
          <p className="font-mono text-label uppercase tabular-nums text-muted-foreground">
            {index}
          </p>
        )}
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        {sub && <p className="mt-2 max-w-[54ch] text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
