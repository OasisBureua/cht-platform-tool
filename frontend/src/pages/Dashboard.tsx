import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { StatCard } from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { DollarSign, Activity, Award, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

// TODO: Replace with actual user ID from Auth0
const TEMP_USER_ID = '1234567890';

export default function Dashboard() {
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['earnings', TEMP_USER_ID],
    queryFn: () => dashboardApi.getEarnings(TEMP_USER_ID),
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', TEMP_USER_ID],
    queryFn: () => dashboardApi.getStats(TEMP_USER_ID),
  });

  if (earningsLoading || statsLoading) {
    return <LoadingSpinner />;
  }

  // Format weekly earnings for chart
  const chartData = earnings?.weeklyEarnings.map((week) => ({
    date: format(new Date(week.weekStartDate), 'MMM d'),
    earnings: week.amount,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back! Here's your performance overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Earnings"
          value={`$${earnings?.totalEarnings.toFixed(2) || '0.00'}`}
          icon={<DollarSign className="w-6 h-6 text-primary-600" />}
          trend={{
            value: earnings?.currentWeekEarnings || 0,
            label: `$${earnings?.currentWeekEarnings.toFixed(2) || '0.00'} this week`,
          }}
        />
        <StatCard
          title="Activities Completed"
          value={stats?.activitiesCompleted || 0}
          icon={<Activity className="w-6 h-6 text-primary-600" />}
        />
        <StatCard
          title="CME Credits"
          value={stats?.cmeCreditsEarned.toFixed(1) || '0.0'}
          icon={<Award className="w-6 h-6 text-primary-600" />}
        />
        <StatCard
          title="Completion Rate"
          value={`${stats?.completionRate || 0}%`}
          icon={<TrendingUp className="w-6 h-6 text-primary-600" />}
        />
      </div>

      {/* Earnings Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Weekly Earnings (Last 12 Weeks)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(2)}`}
              labelStyle={{ color: '#000' }}
            />
            <Line
              type="monotone"
              dataKey="earnings"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={{ fill: '#0ea5e9' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pending Payments */}
      {earnings && earnings.pendingPayments > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Pending Payments:</strong> ${earnings.pendingPayments.toFixed(2)}
          </p>
        </div>
      )}

      {/* Peer Benchmark */}
      {stats?.peerBenchmark && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Peer Comparison
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Average Earnings</p>
              <p className="text-2xl font-bold text-gray-900">
                ${stats.peerBenchmark.averageEarnings}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Your Percentile</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.peerBenchmark.percentile}th
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Top Earners Range</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.peerBenchmark.topEarnersRange}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
