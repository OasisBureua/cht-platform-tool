import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { StripeMark } from '../components/branding/StripeMark';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';
import { paymentsApi } from '../api/payments';
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

  const { data: paymentHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['payments-history', userId],
    queryFn: () => paymentsApi.getHistory(userId),
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

  if (isLoading || loadingHistory) return <LoadingSpinner />;

  const total = earnings?.totalEarnings ?? 0;
  const points = dollarsToPoints(total);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2.5 text-foreground">
          <Banknote className="h-5 w-5 text-steel-600 dark:text-steel-400" strokeWidth={2} aria-hidden />
          <h1 className="text-balance text-2xl font-semibold text-foreground md:text-3xl">Your Earnings</h1>
        </div>
        <p className="text-pretty text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
          Balances and activity. Actual payouts are sent through{' '}
          <StripeMark size="sm" className="translate-y-px" />. Open{' '}
          <Link
            to="/app/settings"
            state={{ settingsTab: 'payment' as const }}
            className="font-medium text-foreground underline hover:no-underline"
          >
            Payment Settings
          </Link>{' '}
          to connect your bank and tax info.
        </p>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-card border border-gray-100/90 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-muted-foreground">Total Balance</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">${total.toFixed(2)}</p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {points.toLocaleString()} points = ${total.toFixed(2)}
          </p>
        </div>

        <div className="rounded-card border border-gray-100/90 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-muted-foreground">This Week</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            ${(earnings?.currentWeekEarnings ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Current week earnings</p>
        </div>

        <div className="rounded-card border border-gray-100/90 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
          <p className="text-sm text-muted-foreground">Pending Payments</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-foreground">
            ${(earnings?.pendingPayments ?? 0).toFixed(2)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {earnings?.lastPaymentDate
              ? `Last payment: ${format(new Date(earnings.lastPaymentDate), 'MMM d, yyyy')}`
              : 'No payments yet'}
          </p>
        </div>
      </section>

      <section className="rounded-card border border-gray-100/90 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-balance text-foreground">Recent Activity</h2>
          <span className="text-sm text-muted-foreground">Last 12 weeks</span>
        </div>

        <div className="mt-4 h-[280px]">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                <Line type="monotone" dataKey="earnings" stroke="#111827" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No activity yet
            </div>
          )}
        </div>
      </section>

      <section className="rounded-card border border-gray-100/90 bg-card p-5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-balance text-foreground">Payment history</h2>
          <Link
            to="/app/payments#payment-history"
            className="min-h-[44px] shrink-0 rounded-[6px] px-3 text-sm font-medium text-foreground underline transition-[color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:no-underline active:scale-[0.96]"
          >
            Full payment history
          </Link>
        </div>

        {paymentHistory.length === 0 ? (
          <div className="mt-4 border border-dashed border-border rounded-card p-8 text-center">
            <p className="text-sm font-semibold text-foreground">No payments yet</p>
            <p className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
              Completed honoraria and bonuses appear here after admins process them through{' '}
              <StripeMark size="xs" className="translate-y-px" />.
            </p>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 border border-gray-100 rounded-card overflow-hidden">
            {paymentHistory.slice(0, 8).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(row.date), 'MMM d, yyyy')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-foreground">${row.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{row.status}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
