import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/**
 * The one button. Before this existed the same markup was hand-written
 * across ~30 call sites with drifting padding, which is why a token
 * change moved the colour and nothing else.
 *
 * Depth, not outlines: every variant carries its own elevation and the
 * only border in the set is the focus ring.
 */
type Variant = 'solid' | 'accent' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] font-medium ' +
  'transition-[background-color,color,box-shadow,scale] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-50 ' +
  'motion-safe:active:not(:disabled):scale-[0.96]';

const VARIANT: Record<Variant, string> = {
  /** Primary action. brand-600 is the one step that carries white at AA. */
  solid: 'bg-brand-600 text-white shadow-card hover:bg-brand-700',
  accent: 'bg-accent text-accent-foreground shadow-card hover:bg-accent-hover',
  /** Secondary: reads as a control through elevation, not a hairline. */
  outline:
    'bg-card text-foreground shadow-card hover:bg-muted hover:shadow-card-hover',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-destructive text-destructive-foreground shadow-card hover:brightness-95',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a router Link instead of a button. */
  to?: string;
  /** Renders an anchor. Use for genuinely external destinations. */
  href?: string;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'solid', size = 'md', to, href, className, children, ...rest },
  ref,
) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);

  // Navigation is a link so it keeps cmd/ctrl/middle-click; only real
  // actions render as a button.
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});
