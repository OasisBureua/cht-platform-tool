import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { Banknote } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

import { useAuth } from '../contexts/AuthContext';

function dollarsToPoints(dollars: number) {
  // TODO: replace with real conversion rate once backend defines it
  return Math.round(dollars);
}

export default function Earnings() {
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const { data: earnings, isLoading } = useQuery({
    queryKey: ['earnings', userId],
    queryFn: () => dashboardApi.getEarnings(userId),
    enabled: !!userId,
  });

  const chartData = useMemo(() => {
    return (
      earnings?.weeklyEarnings.map((w) => ({
        date: format(new Date(w.weekStartDate), 'MMM d'),
        earnings: w.amount,
      })) || []
    );
  }, [earnings]);

  if (isLoading) return <LoadingSpinner />;

  const total = earnings?.totalEarnings ?? 0;
  const points = dollarsToPoints(total);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2.5 text-gray-900">
          <Banknote className="h-5 w-5 text-brand-700" strokeWidth={2} aria-hidden />
          <h1 className="text-balance text-2xl font-semibold text-gray-900 md:text-3xl">Your Earnings</h1>
        </div>
        <p className="text-pretty text-sm text-gray-600">Track your income and payment history</p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-gray-600">Total Balance</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">${total.toFixed(2)}</p>
          <p className="mt-1 text-sm text-gray-600 tabular-nums">
            {points.toLocaleString()} points = ${total.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-gray-600">This Week</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">
            ${(earnings?.currentWeekEarnings ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-gray-600">Current week earnings</p>
        </div>

        <div className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-gray-600">Pending Payments</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">
            ${(earnings?.pendingPayments ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {earnings?.lastPaymentDate
              ? `Last payment: ${format(new Date(earnings.lastPaymentDate), 'MMM d, yyyy')}`
              : 'No payments yet'}
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-balance text-gray-900">Recent Activity</h2>
          <span className="text-sm text-gray-600">Last 12 weeks</span>
        </div>

        <div className="mt-4 h-[280px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                <Line type="monotone" dataKey="earnings" stroke="#111827" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-gray-600">
              No activity yet
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100/90 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-balance text-gray-900">Payment History</h2>
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] rounded-lg px-3 text-sm font-medium text-gray-700 transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:text-gray-900 active:scale-[0.96]"
          >
            View all
          </button>
        </div>

        <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No Activity Yet</p>
          <p className="mt-1 text-sm text-gray-600">
            Recent payments and withdrawals will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
