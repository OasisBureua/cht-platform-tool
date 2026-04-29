import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link to="/admin/users" className="group relative block rounded-2xl border border-blue-200 bg-blue-50/50 p-6 transition-[border-color,box-shadow] hover:border-blue-400 hover:ring-2 hover:ring-blue-200">
          <span className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-semibold ${activeHcpsChange?.colorClass ?? 'bg-gray-100 text-gray-700'}`}>
            {activeHcpsChange?.label ?? '-'}
          </span>
          <p className="text-3xl font-bold tabular-nums text-gray-900">{stats?.activeHcpsCount ?? 0}</p>
          <p className="mt-2 text-sm font-semibold text-blue-700 group-hover:underline">Active HCPs</p>
        </Link>
        <Link to="/admin/rx-analytics" className="group relative block rounded-2xl border border-purple-200 bg-purple-50/50 p-6 transition-[border-color,box-shadow] hover:border-purple-400 hover:ring-2 hover:ring-purple-200">
          <span className="absolute top-3 right-3 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">% change</span>
          <p className="text-3xl font-bold text-gray-400">#</p>
          <p className="mt-2 text-sm font-semibold text-purple-700 group-hover:underline">Engagement Rate</p>
        </Link>
        <Link to="/admin/payments" className="group block rounded-2xl border border-amber-200 bg-amber-50/50 p-6 transition-[border-color,box-shadow] hover:border-amber-400 hover:ring-2 hover:ring-amber-200">
          <p className="text-3xl font-bold tabular-nums text-gray-900">{stats?.paymentsPaidCount ?? 0}</p>
          <p className="mt-2 text-sm font-semibold text-amber-700 group-hover:underline">Payments Made</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Analytics */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Analytics</h2>
            <Link to="/admin/rx-analytics" className="text-sm font-medium text-gray-600 hover:text-gray-900">View All Activities</Link>
          </div>
          <p className="text-sm text-gray-600">
            Metric Display of total amount earned with distinction of type of activity completed this week
          </p>
          <div className="flex justify-center py-8">
            <div className="h-48 w-48 rounded-full border-8 border-gray-200 border-t-gray-400 border-r-gray-300 border-b-gray-300 border-l-gray-400" style={{ transform: 'rotate(-45deg)' }} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">Campaign Performance</h2>
            <div className="mt-4 h-32 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
              <p className="text-sm text-gray-500">Campaign data</p>
            </div>
          </div>
          <Link to="/admin/payments" className="group block rounded-2xl border border-gray-200 bg-white p-6 transition-[border-color,box-shadow] hover:border-amber-200 hover:ring-2 hover:ring-amber-100">
            <p className="text-3xl font-bold tabular-nums text-amber-600">{stats?.paymentsPaidCount ?? 0}</p>
            <p className="mt-2 text-sm font-semibold text-amber-700 group-hover:underline">Payments Made</p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                {(pendingPayments?.length ?? 0) > 0 ? (
                  <span className="font-medium tabular-nums text-amber-700">{pendingPayments?.length ?? 0} pending</span>
                ) : (
                  'All caught up'
                )}
              </p>
              <p className="mt-1 text-xs font-medium text-amber-600 group-hover:underline">View all payments →</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
