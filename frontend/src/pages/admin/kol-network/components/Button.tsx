import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

/**
 * shadcn-pattern Button with cva variants, restyled to CHT platform tokens.
 * Pill radius per the platform's fully-rounded language; teal primary CTA.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold',
    'transition-all duration-200 transform-gpu',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-card hover:bg-primary-hover',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        /** Orange accent CTA: sparingly. */
        accent: 'bg-accent text-accent-foreground shadow-card hover:bg-accent-hover',
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-8 px-3.5 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
