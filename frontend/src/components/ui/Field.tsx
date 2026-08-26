import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * A labelled control. Every field keeps a visible label: a placeholder
 * disappears the moment someone types, so it can never be the only one.
 *
 * The error is wired through aria-describedby and the input is marked
 * aria-invalid, so the message is announced rather than only coloured.
 * Text stays at 16px on mobile, below which iOS zooms the whole page.
 */
export function Field({
  label,
  error,
  hint,
  aside,
  className,
  id: providedId,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /** Sits at the end of the label row, e.g. a "Forgot?" link. */
  aside?: ReactNode;
}) {
  const uid = useId();
  const id = providedId ?? `${uid}-field`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          {label}
        </label>
        {aside}
      </div>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          'mt-2 h-12 w-full rounded-[6px] bg-card px-4 text-base text-foreground shadow-card',
          'outline-none placeholder:text-muted-foreground/70 sm:text-sm',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          error && 'ring-2 ring-destructive',
        )}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-2 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
