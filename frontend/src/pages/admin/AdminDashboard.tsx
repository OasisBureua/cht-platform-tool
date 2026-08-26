import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  FileBarChart,
  Radio,
  Wallet2,
  Users,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { getPercentChangeLabel } from '../../utils/percentChange';

function formatDollars(cents: number | undefined) {
  const n = typeof cents === 'number' ? cents : 0;
  return `$${(n / 100).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: adminApi.getStats,
  });

  const { data: pendingPayments } = useQuery({
    queryKey: ['admin', 'pending-payments'],
    queryFn: adminApi.getPendingPayments,
  });

  const activeHcpsChange = stats
    ? getPercentChangeLabel(stats.activeHcpsCount ?? 0, stats.activeHcpsCountPreviousWeek ?? 0)
    : null;

  const pendingCount = pendingPayments?.length ?? stats?.pendingPaymentsCount ?? 0;
  const pendingRegs = stats?.pendingRegistrationsCount ?? 0;
  const livePrograms = stats?.publishedLiveProgramsCount ?? 0;
  const paidCents = stats?.paymentsPaidCents ?? 0;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-balance text-xl font-bold tracking-tight text-foreground md:text-2xl">
          Admin Dashboard
        </h1>
      </div>

      <div className="rounded-card border border-brand-200/80 bg-gradient-to-br from-brand-50/90 to-white p-5 shadow-card dark:border-brand-900/50 dark:from-brand-950/40 dark:to-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-100">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">Live webinars & Office Hours</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                Manage live Zoom Webinars, Office Hours, Program hub time slots, and registration approvals in one place.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link
              to="/admin/programs"
              className="inline-flex items-center justify-center rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-zinc-900 dark:text-brand-100 dark:hover:bg-brand-950/50"
            >
              View Live Webinars
            </Link>
            <Link
              to="/admin/office-hours"
              className="inline-flex items-center justify-center rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-900 transition-colors hover:bg-brand-50 dark:border-brand-800 dark:bg-zinc-900 dark:text-brand-100 dark:hover:bg-brand-950/50"
            >
              View Office Hours
            </Link>
            <Link
              to="/admin/webinar-scheduler"
              className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Schedule webinar
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-12 md:gap-5">
        <Link
          to="/admin/users"
          className="group relative col-span-2 overflow-hidden rounded-card bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-[0_12px_40px_-24px_rgba(14,116,188,0.2)] ring-1 ring-sky-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-28px_rgba(14,116,188,0.28)] md:col-span-5 dark:from-sky-950/40 dark:via-zinc-900 dark:to-zinc-950 dark:ring-sky-900/40"
        >
          <span
            className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${activeHcpsChange?.colorClass ?? 'bg-white/80 text-gray-600 shadow-card dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {activeHcpsChange?.label ?? '-'}
          </span>
          <Users className="mb-3 h-8 w-8 text-sky-600 opacity-90 dark:text-sky-400" strokeWidth={1.75} aria-hidden />
          <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-zinc-50 md:text-4xl">
            {stats?.activeHcpsCount ?? 0}
          </p>
          <p className="mt-1 text-sm font-semibold text-sky-800 group-hover:underline dark:text-sky-300">Active HCPs</p>
        </Link>

        <Link
          to="/admin/webinar-approvals"
          className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_10px_36px_-22px_rgba(91,33,182,0.22)] ring-1 ring-violet-100/70 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 md:col-span-4 dark:from-violet-950/35 dark:to-zinc-900 dark:ring-violet-900/30"
        >
          <ClipboardCheck className="h-6 w-6 text-violet-600 dark:text-violet-400" strokeWidth={1.75} aria-hidden />
          <div className="mt-3">
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-50">{pendingRegs}</p>
            <p className="mt-0.5 text-xs font-semibold text-violet-800 group-hover:underline dark:text-violet-300">
              Pending approvals
            </p>
          </div>
        </Link>

        <Link
          to="/admin/payments"
          className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-card bg-gradient-to-br from-amber-50 to-white p-4 shadow-[0_10px_36px_-22px_rgba(180,83,9,0.2)] ring-1 ring-amber-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 md:col-span-3 dark:from-amber-950/30 dark:to-zinc-900 dark:ring-amber-900/35"
        >
          <Wallet2 className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden />
          <div className="mt-3">
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-50">
              {stats?.paymentsPaidCount ?? 0}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-warning group-hover:underline dark:text-amber-300">
              Payments paid
            </p>
          </div>
        </Link>

        <div className="col-span-2 flex min-h-[220px] flex-col justify-between rounded-card bg-white/90 p-5 shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)] ring-1 ring-gray-200/80 dark:bg-zinc-900/80 dark:ring-zinc-700/60 md:col-span-8 md:min-h-[280px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground md:text-lg">Ops snapshot</h2>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Live programs, payout volume, and queues
              </p>
            </div>
            <Link
              to="/admin/content-hub"
              className="shrink-0 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
            >
              Reporting →
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-4">
              <Radio className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {livePrograms}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Published live sessions
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {formatDollars(paidCents)}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Total paid (all time)
              </p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <Wallet2 className="h-5 w-5 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-2xl font-bold tabular-nums text-foreground">
                {pendingCount}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                Pending payouts
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-col gap-3 md:col-span-4 md:gap-5">
          <Link
            to="/admin/content-hub"
            className="rounded-card bg-white/90 p-4 shadow-[0_10px_40px_-26px_rgba(0,0,0,0.14)] ring-1 ring-gray-200/70 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 dark:bg-zinc-900/80 dark:ring-zinc-700/60"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-foreground">Campaign reporting</h2>
              <FileBarChart className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Content Hub analytics, executive reports, HubSpot sync, and CSV uploads.
            </p>
            <p className="mt-3 text-xs font-semibold text-brand-700 dark:text-brand-400">
              Open Content Hub →
            </p>
          </Link>

          <Link
            to="/admin/payments"
            className="group rounded-card bg-gradient-to-br from-amber-50/90 via-white to-white p-4 shadow-[0_12px_40px_-24px_rgba(180,83,9,0.18)] ring-1 ring-amber-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-950 dark:ring-amber-900/30"
          >
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {pendingCount}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-warning group-hover:underline dark:text-amber-300">
              Payments queue
            </p>
            <div className="mt-3 rounded-xl bg-white/80 p-3 shadow-inner dark:bg-zinc-800/50">
              <p className="text-xs text-gray-600 dark:text-zinc-400">
                {pendingCount > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums text-warning dark:text-amber-400">{pendingCount}</span>{' '}
                    pending
                  </>
                ) : (
                  'All caught up'
                )}
              </p>
              <p className="mt-1 text-xs font-medium text-warning group-hover:underline dark:text-amber-400">
                Open payments →
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
