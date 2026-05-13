import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CalendarClock, Radio, Wallet2, Users } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { getPercentChangeLabel } from '../../utils/percentChange';

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

  const pendingCount = pendingPayments?.length ?? 0;

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-balance text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 md:text-2xl">
          Admin Dashboard
        </h1>
      </div>

      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-white p-5 shadow-sm dark:border-teal-900/50 dark:from-teal-950/40 dark:to-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-100">
              <CalendarClock className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100">CHM Office Hours</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                Manage interactive Zoom Meetings, time slots (Program hub), and the office-hours approval queue alongside Live webinars.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Link
              to="/admin/office-hours"
              className="inline-flex items-center justify-center rounded-lg border border-teal-300 bg-white px-4 py-2 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-50 dark:border-teal-800 dark:bg-zinc-900 dark:text-teal-100 dark:hover:bg-teal-950/50"
            >
              View sessions
            </Link>
            <Link
              to="/admin/office-hours-scheduler"
              className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
            >
              Schedule office hours
            </Link>
          </div>
        </div>
      </div>

      {/* Bento: asymmetric grid — dense on small screens, full 12-col on md+ */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-12 md:gap-5">
        {/* Hero metric */}
        <Link
          to="/admin/users"
          className="group relative col-span-2 overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-[0_12px_40px_-24px_rgba(14,116,188,0.2)] ring-1 ring-sky-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_-28px_rgba(14,116,188,0.28)] md:col-span-5 dark:from-sky-950/40 dark:via-zinc-900 dark:to-zinc-950 dark:ring-sky-900/40"
        >
          <span
            className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs ${activeHcpsChange?.colorClass ?? 'bg-white/80 text-gray-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300'}`}
          >
            {activeHcpsChange?.label ?? '—'}
          </span>
          <Users className="mb-3 h-8 w-8 text-sky-600 opacity-90 dark:text-sky-400" strokeWidth={1.75} aria-hidden />
          <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-zinc-50 md:text-4xl">
            {stats?.activeHcpsCount ?? 0}
          </p>
          <p className="mt-1 text-sm font-semibold text-sky-800 group-hover:underline dark:text-sky-300">Active HCPs</p>
        </Link>

        {/* Engagement — compact tile */}
        <Link
          to="/admin/rx-analytics"
          className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_10px_36px_-22px_rgba(91,33,182,0.22)] ring-1 ring-violet-100/70 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 md:col-span-4 dark:from-violet-950/35 dark:to-zinc-900 dark:ring-violet-900/30"
        >
          <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" strokeWidth={1.75} aria-hidden />
          <div className="mt-3">
            <p className="text-2xl font-bold text-gray-400 tabular-nums dark:text-zinc-500">#</p>
            <p className="mt-0.5 text-xs font-semibold text-violet-800 group-hover:underline dark:text-violet-300">
              Engagement
            </p>
          </div>
        </Link>

        {/* Payments snapshot */}
        <Link
          to="/admin/payments"
          className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4 shadow-[0_10px_36px_-22px_rgba(180,83,9,0.2)] ring-1 ring-amber-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 md:col-span-3 dark:from-amber-950/30 dark:to-zinc-900 dark:ring-amber-900/35"
        >
          <Wallet2 className="h-6 w-6 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden />
          <div className="mt-3">
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-zinc-50">
              {stats?.paymentsPaidCount ?? 0}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-amber-800 group-hover:underline dark:text-amber-300">
              Payments
            </p>
          </div>
        </Link>

        {/* Analytics — wide */}
        <div className="col-span-2 flex min-h-[220px] flex-col justify-between rounded-2xl bg-white/90 p-5 shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)] ring-1 ring-gray-200/80 dark:bg-zinc-900/80 dark:ring-zinc-700/60 md:col-span-8 md:min-h-[280px]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-zinc-100 md:text-lg">Analytics</h2>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-gray-600 dark:text-zinc-400 sm:text-sm">
                Activity mix and earnings for the current week
              </p>
            </div>
            <Link
              to="/admin/rx-analytics"
              className="shrink-0 text-xs font-semibold text-brand-700 hover:underline dark:text-brand-400"
            >
              View all
            </Link>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-6">
            <div
              className="h-36 w-36 rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.06)] ring-8 ring-gray-100/90 dark:ring-zinc-800/90"
              style={{
                background:
                  'conic-gradient(from 180deg, rgb(59 130 246 / 0.35), rgb(168 85 247 / 0.35), rgb(52 211 153 / 0.35), rgb(59 130 246 / 0.35))',
              }}
              aria-hidden
            />
            <p className="mt-3 text-center text-xs text-gray-500 dark:text-zinc-500">Placeholder breakdown</p>
          </div>
        </div>

        {/* Stacked column — campaign + queue */}
        <div className="col-span-2 flex flex-col gap-3 md:col-span-4 md:gap-5">
          <div className="rounded-2xl bg-white/90 p-4 shadow-[0_10px_40px_-26px_rgba(0,0,0,0.14)] ring-1 ring-gray-200/70 dark:bg-zinc-900/80 dark:ring-zinc-700/60">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">Campaign</h2>
              <Radio className="h-4 w-4 text-gray-400 dark:text-zinc-500" aria-hidden />
            </div>
            <div className="mt-3 flex min-h-[100px] items-center justify-center rounded-xl bg-gradient-to-b from-gray-50 to-gray-100/80 text-center dark:from-zinc-800/80 dark:to-zinc-900/50">
              <p className="px-2 text-xs text-gray-500 dark:text-zinc-500">Campaign performance · coming soon</p>
            </div>
          </div>

          <Link
            to="/admin/payments"
            className="group rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-white p-4 shadow-[0_12px_40px_-24px_rgba(180,83,9,0.18)] ring-1 ring-amber-100/80 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 dark:from-amber-950/25 dark:via-zinc-900 dark:to-zinc-950 dark:ring-amber-900/30"
          >
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {stats?.paymentsPaidCount ?? 0}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-amber-800 group-hover:underline dark:text-amber-300">
              Payments queue
            </p>
            <div className="mt-3 rounded-xl bg-white/80 p-3 shadow-inner dark:bg-zinc-800/50">
              <p className="text-xs text-gray-600 dark:text-zinc-400">
                {pendingCount > 0 ? (
                  <>
                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">{pendingCount}</span>{' '}
                    pending
                  </>
                ) : (
                  'All caught up'
                )}
              </p>
              <p className="mt-1 text-xs font-medium text-amber-700 group-hover:underline dark:text-amber-400">
                Open payments →
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
