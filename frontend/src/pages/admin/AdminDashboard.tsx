import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link to="/admin/users" className="group block rounded-2xl border border-blue-200 bg-blue-50/50 p-6 relative hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-all">
          <span className={`absolute top-3 right-3 rounded-full px-2 py-1 text-xs font-semibold ${activeHcpsChange?.colorClass ?? 'bg-gray-100 text-gray-700'}`}>
            {activeHcpsChange?.label ?? '—'}
          </span>
          <p className="text-3xl font-bold text-gray-900">{stats?.activeHcpsCount ?? 0}</p>
          <p className="mt-2 text-sm font-semibold text-blue-700 group-hover:underline">Active HCPs</p>
        </Link>
        <Link to="/admin/rx-analytics" className="group block rounded-2xl border border-purple-200 bg-purple-50/50 p-6 relative hover:border-purple-400 hover:ring-2 hover:ring-purple-200 transition-all">
          <span className="absolute top-3 right-3 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">% change</span>
          <p className="text-3xl font-bold text-gray-400">#</p>
          <p className="mt-2 text-sm font-semibold text-purple-700 group-hover:underline">Engagement Rate</p>
        </Link>
        <Link to="/admin/payments" className="group block rounded-2xl border border-amber-200 bg-amber-50/50 p-6 hover:border-amber-400 hover:ring-2 hover:ring-amber-200 transition-all">
          <p className="text-3xl font-bold text-gray-900">{stats?.paymentsPaidCount ?? 0}</p>
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
          <Link to="/admin/payments" className="group block rounded-2xl border border-gray-200 bg-white p-6 hover:border-amber-200 hover:ring-2 hover:ring-amber-100 transition-all">
            <p className="text-3xl font-bold text-amber-600">{stats?.paymentsPaidCount ?? 0}</p>
            <p className="mt-2 text-sm font-semibold text-amber-700 group-hover:underline">Payments Made</p>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                {(pendingPayments?.length ?? 0) > 0 ? (
                  <span className="font-medium text-amber-700">{pendingPayments?.length ?? 0} pending</span>
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
