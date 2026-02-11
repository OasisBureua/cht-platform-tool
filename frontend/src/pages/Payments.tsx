import { useMemo } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { ExternalLink, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { format } from 'date-fns';

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function statusChip(status: PaymentStatus) {
  const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold';
  if (status === 'PAID') return `${base} border-green-200 bg-green-50 text-green-800`;
  if (status === 'PROCESSING') return `${base} border-blue-200 bg-blue-50 text-blue-800`;
  if (status === 'PENDING') return `${base} border-yellow-200 bg-yellow-50 text-yellow-800`;
  return `${base} border-red-200 bg-red-50 text-red-800`;
}

function statusIcon(status: PaymentStatus) {
  if (status === 'PAID') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'PROCESSING') return <Clock3 className="h-4 w-4" />;
  if (status === 'PENDING') return <AlertCircle className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

export default function Payments() {
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['payments-summary', userId],
    queryFn: () => paymentsApi.getSummary(userId),
    enabled: !!userId,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['payments-history', userId],
    queryFn: () => paymentsApi.getHistory(userId),
    enabled: !!userId,
  });

  const connectMutation = useMutation({
    mutationFn: () => paymentsApi.createConnectLink(userId),
    onSuccess: ({ url }) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });

  const totalThisMonth = useMemo(() => {
    const items = history || [];
    const now = new Date();
    return items
      .filter((i) => {
        const d = new Date(i.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, i) => sum + i.amount, 0);
  }, [history]);

  if (loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-600">
          Add your bank details to receive payouts. Admins process payouts (ACH or check) and verify W-9 in Bill.com.
        </p>
      </header>

      {/* Bill.com connect banner */}
      <div className="rounded-3xl border border-gray-200 bg-gray-900 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Get paid faster with Bill.com</p>
            <p className="text-sm text-gray-300">
              Add your bank details so admins can send you payouts via ACH or check. W-9 must be on file.
            </p>
          </div>

          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className={[
              'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold',
              connectMutation.isPending ? 'bg-gray-200 text-gray-700' : 'bg-white text-gray-900 hover:bg-gray-100',
            ].join(' ')}
          >
            {connectMutation.isPending ? 'Opening…' : 'Connect Bill.com'}
            <ExternalLink className="ml-2 h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Available balance" value={formatMoney(summary!.availableBalance)} sub="Ready to withdraw" />
        <StatCard label="Pending balance" value={formatMoney(summary!.pendingBalance)} sub="Processing rewards" />
        <StatCard label="This month" value={formatMoney(totalThisMonth)} sub="Earned so far" />
      </section>

      {/* Payout info */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">Payouts</p>
            <p className="text-sm text-gray-600">
              Last payout:{' '}
              <span className="font-semibold text-gray-900">
                {summary!.lastPayoutDate ? format(new Date(summary!.lastPayoutDate), 'MMM d, yyyy') : '—'}
              </span>
              {' · '}
              Admins process payouts via Bill.com (ACH or check) and verify W-9 on file.
            </p>
          </div>
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Payment history</h2>
          <span className="text-sm text-gray-600">{(history || []).length} items</span>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {(history || []).map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>

          {(history || []).length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-gray-900">No payments yet</p>
              <p className="mt-1 text-sm text-gray-600">Complete activities to start earning.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{sub}</p>
    </div>
  );
}

function HistoryRow({ item }: { item: PaymentItem }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.title}</p>
        <p className="text-sm text-gray-600 truncate">
          {format(new Date(item.date), 'MMM d, yyyy')} • {item.method || '—'}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{formatMoney(item.amount)}</span>
        <span className={statusChip(item.status)}>
          {statusIcon(item.status)}
          {item.status}
        </span>
      </div>
    </div>
  );
}
