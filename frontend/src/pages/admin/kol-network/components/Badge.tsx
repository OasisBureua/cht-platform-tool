import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * shadcn-pattern Badge with cva variants (rounded-pill, dark-aware tokens).
 * `teal` / `orange` are the soft-tint pills from the HCP Intel design;
 * `accent` / `positive` / `outline` are kept for existing callers
 * (AdminKolDirectory renders `accent` for the "New" marker).
 */
export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200',
  {
    variants: {
      variant: {
        /** Teal primary — the platform CTA color. */
        default: 'border-transparent bg-primary text-primary-foreground',
        /** Soft teal tint — "engaged / active / good" states. */
        teal: 'border-transparent bg-primary/10 text-primary-700 dark:bg-primary/20 dark:text-primary-300',
        /** Soft orange tint — attribution / lift callouts. */
        orange:
          'border-transparent bg-accent/10 text-accent-700 dark:bg-accent/20 dark:text-accent-300',
        muted: 'border-transparent bg-muted text-muted-foreground',
        /** Solid orange accent — the pop color, use sparingly. */
        accent: 'border-transparent bg-accent text-accent-foreground',
        outline: 'border-border text-foreground',
        /** Alias of `teal` kept for existing call sites. */
        positive: 'border-primary/40 bg-primary/10 text-primary-700 dark:text-primary-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';

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
