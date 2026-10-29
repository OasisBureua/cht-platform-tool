import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../../lib/cn';

/**
 * Sticky instrument-panel filter strip. Persist filter values in the URL in later chunks;
 * this shell only owns layout + search field chrome.
 */
export function SurveyFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search surveys…',
  filters,
  trailing,
  className,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 rounded-card border border-border bg-card/95 px-4 py-4 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/85',
        className,
      )}
    >
      <div className="flex flex-col gap-4">
        {(onSearchChange || trailing) && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {onSearchChange ? (
              <label className="relative block w-full min-w-0 flex-1">
                <span className="sr-only">Search surveys</span>
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={search ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
                />
              </label>
            ) : null}
            {trailing ? (
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {trailing}
              </div>
            ) : null}
          </div>
        )}

        {filters ? (
          <div
            className={cn(
              'flex flex-wrap items-center gap-3',
              onSearchChange || trailing
                ? 'border-t border-border pt-4'
                : undefined,
            )}
          >
            {filters}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SurveyFilterSelect({
  label,
  value,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'inline-flex h-11 items-center gap-2.5 rounded-lg border border-border bg-background px-3 text-sm',
        className,
      )}
    >
      <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-[6.5rem] border-0 bg-transparent py-0 pe-1 text-sm font-medium text-foreground focus:outline-none focus-visible:ring-0"
      >
        {children}
      </select>
    </label>
  );
}
