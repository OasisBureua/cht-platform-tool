import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-6 relative">
          <span className="absolute top-3 right-3 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">% change</span>
          <p className="text-3xl font-bold text-gray-400">#</p>
          <p className="mt-2 text-sm font-semibold text-blue-700">Of Active HCPs</p>
        </div>
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-6 relative">
          <span className="absolute top-3 right-3 rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">% change</span>
          <p className="text-3xl font-bold text-gray-400">#</p>
          <p className="mt-2 text-sm font-semibold text-purple-700">Engagement Rate</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
          <p className="text-3xl font-bold text-gray-400">#</p>
          <p className="mt-2 text-sm font-semibold text-amber-700">Payments Made</p>
        </div>
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
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-3xl font-bold text-amber-600">#</p>
            <p className="mt-2 text-sm font-semibold text-amber-700">Payments Made</p>
            <div className="mt-4 h-24 rounded-lg border border-dashed border-gray-200 flex items-center justify-center">
              <p className="text-sm text-gray-500">Details</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
