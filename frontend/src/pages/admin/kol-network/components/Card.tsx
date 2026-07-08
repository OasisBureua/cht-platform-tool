import type { HTMLAttributes } from 'react';
import { cn } from './cn';

/**
 * Minimal token-styled Card (ported structure from MediaHub shadcn card.tsx,
 * restyled to CHT platform tokens: bg-card / border-border / rounded-card /
 * shadow-card, dark-aware via CSS vars).
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-card text-card-foreground shadow-card',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-base font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}
