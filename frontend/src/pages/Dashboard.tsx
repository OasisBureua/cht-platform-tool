import { useQuery } from '@tanstack/react-query';
import { DollarSign, Activity, Award, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { dashboardApi } from '../api/dashboard';

export default function Dashboard() {
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['earnings'],
    queryFn: dashboardApi.getEarnings,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: dashboardApi.getStats,
  });

  if (earningsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  // Format chart data
  const chartData = earnings?.weeklyEarnings.map(week => ({
    date: new Date(week.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    earnings: week.amount,
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Total Earnings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${earnings?.totalEarnings || 0}</div>
              <p className="text-xs text-muted-foreground">
                ${earnings?.currentWeekEarnings || 0} this week
              </p>
            </CardContent>
          </Card>

          {/* Activities Completed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activitiesCompleted || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activitiesInProgress || 0} in progress
              </p>
            </CardContent>
          </Card>

          {/* CME Credits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CME Credits</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.cmeCreditsEarned || 0}</div>
              <p className="text-xs text-muted-foreground">Total credits earned</p>
            </CardContent>
          </Card>

          {/* Completion Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.completionRate || 0}%</div>
              <p className="text-xs text-muted-foreground">Of enrolled programs</p>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Weekly Earnings</CardTitle>
            <CardDescription>Your earnings over the last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [`$${value}`, 'Earnings']}
                />
                <Line 
                  type="monotone" 
                  dataKey="earnings" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pending Payments */}
        {earnings && earnings.pendingPayments > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Payments</CardTitle>
              <CardDescription>Payments being processed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${earnings.pendingPayments}</div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
