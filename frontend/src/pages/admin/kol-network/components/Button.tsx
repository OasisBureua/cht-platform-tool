import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'accent';
export type ButtonSize = 'default' | 'sm' | 'icon';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  /** Orange accent CTA — sparingly. */
  accent: 'bg-accent text-accent-foreground hover:bg-accent-hover',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  icon: 'h-9 w-9',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/**
 * Minimal token-styled Button (ported structure from MediaHub shadcn
 * button.tsx; teal primary, token radius, ring-ring focus, Chillax via
 * global font-sans).
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
