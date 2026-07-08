import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeVariant = 'default' | 'accent' | 'muted' | 'outline' | 'positive';

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  /** Teal primary — the platform CTA color. */
  default: 'border-transparent bg-primary text-primary-foreground',
  /** Orange accent — the pop color, use sparingly. */
  accent: 'border-transparent bg-accent text-accent-foreground',
  muted: 'border-transparent bg-muted text-muted-foreground',
  outline: 'border-border text-foreground',
  /** Soft teal tint for "active / good" states. */
  positive: 'border-primary/40 bg-primary/10 text-primary-700 dark:text-primary-300',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Token-styled pill badge (rounded-pill, dark-aware via tokens). */
export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold',
        VARIANT_CLASS[variant],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Subtle marker for sections powered by the demo-data seam (lib/intel.ts)
 * rather than a live CHT backend endpoint.
 */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      title="Representative demo data — MediaHub intel endpoints are not proxied through the CHT backend yet."
      className={cn(
        'inline-flex items-center rounded-pill border border-dashed border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      Demo data
    </span>
  );
}
