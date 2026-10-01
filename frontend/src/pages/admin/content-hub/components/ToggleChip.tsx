import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../../../lib/cn';

export function ToggleChip({
  on,
  onClick,
  children,
  title,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-[6px] px-3 text-sm transition-[background-color,color,box-shadow] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        on
          ? 'bg-brand-600 text-white shadow-card hover:bg-brand-700'
          : 'bg-card text-muted-foreground shadow-card hover:bg-muted hover:text-foreground',
      )}
    >
      {on ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}
