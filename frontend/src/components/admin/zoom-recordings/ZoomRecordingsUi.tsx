import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../lib/cn';
import { Button } from '../../ui/Button';
import LoadingSpinner from '../../ui/LoadingSpinner';

export function ZoomStatusBadge({
  tone,
  children,
  icon: Icon,
  className,
}: {
  tone: 'success' | 'warning' | 'neutral' | 'info';
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const tones = {
    success:
      'border-green-200/80 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950/80 dark:text-green-100',
    warning:
      'border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-100',
    neutral: 'border-border bg-muted/60 text-muted-foreground',
    info: 'border-blue-200/80 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/80 dark:text-blue-100',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function ZoomAlert({
  tone,
  title,
  children,
  className,
}: {
  tone: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const config = {
    info: {
      Icon: Info,
      box: 'border-blue-200/70 bg-blue-50/80 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100',
      icon: 'text-blue-600 dark:text-blue-300',
    },
    success: {
      Icon: CheckCircle2,
      box: 'border-green-200/70 bg-green-50/80 text-green-950 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-100',
      icon: 'text-green-600 dark:text-green-300',
    },
    warning: {
      Icon: AlertTriangle,
      box: 'border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100',
      icon: 'text-amber-600 dark:text-amber-300',
    },
    error: {
      Icon: AlertCircle,
      box: 'border-destructive/25 bg-destructive/10 text-destructive',
      icon: 'text-destructive',
    },
  }[tone];
  const { Icon, box, icon } = config;

  return (
    <div className={cn('flex gap-2 rounded-lg border px-3 py-2 text-xs shadow-card', box, className)}>
      <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', icon)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        {title ? <p className="text-xs font-semibold">{title}</p> : null}
        <div className={title ? 'text-[11px] leading-snug opacity-90' : 'text-xs'}>{children}</div>
      </div>
    </div>
  );
}

export function ZoomSectionCard({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn('rounded-card bg-card p-5 shadow-card md:p-6', className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function ZoomEmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card bg-card px-6 py-14 text-center shadow-card">
      <div className="mx-auto grid size-14 place-items-center rounded-[10px] bg-muted text-muted-foreground">
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ZoomLoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card bg-card py-16 shadow-card">
      <LoadingSpinner />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function ZoomFilterTabs({
  tabs,
}: {
  tabs: Array<{ to: string; end?: boolean; label: string }>;
}) {
  return (
    <div
      className="inline-flex gap-1 rounded-[8px] bg-surface p-1 shadow-card"
      role="tablist"
      aria-label="Zoom recordings filters"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          role="tab"
          className={({ isActive }) =>
            cn(
              'inline-flex h-9 items-center whitespace-nowrap rounded-[6px] px-4 text-sm transition-[background-color,color,box-shadow] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              isActive
                ? 'bg-ground font-medium text-foreground shadow-card'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

export function ZoomJobBanner({
  tone,
  title,
  detail,
  progress,
}: {
  tone: 'running' | 'success' | 'error';
  title: string;
  detail?: string;
  progress?: { pct: number; label: string };
}) {
  const tones = {
    running: 'border-border bg-muted/40 text-foreground',
    success:
      'border-green-200/70 bg-green-50/90 text-green-950 dark:border-green-900/50 dark:bg-green-950/50 dark:text-green-100',
    error: 'border-destructive/25 bg-destructive/10 text-destructive',
  };

  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs', tones[tone])}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {tone === 'running' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        ) : tone === 'success' ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <span className="font-medium">{title}</span>
        {progress ? (
          <span className="text-muted-foreground">{progress.label}</span>
        ) : null}
        {detail && !progress ? (
          <span className="text-muted-foreground">· {detail}</span>
        ) : null}
      </div>
      {progress && progress.pct >= 0 ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              tone === 'error' ? 'bg-destructive' : tone === 'success' ? 'bg-green-600' : 'bg-brand-600',
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress.pct))}%` }}
          />
        </div>
      ) : null}
      {detail && progress ? <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function ZoomBackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      {children}
    </Link>
  );
}

export function ZoomPrimaryActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  );
}

export { Button };
