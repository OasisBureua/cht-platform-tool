import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import { StripeConnectOnboarding } from '../components/payments/StripeConnectOnboarding';
import { StripeMark } from '../components/branding/StripeMark';

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function statusChip(status: PaymentStatus) {
  const base = 'inline-flex items-center gap-2 rounded-[6px] border px-3 py-1 text-xs font-semibold';
  if (status === 'PAID') return `${base} border-success/25 bg-success/10 text-success`;
  if (status === 'PROCESSING') return `${base} border-blue-200 bg-blue-50 text-blue-800`;
  if (status === 'PENDING') return `${base} border-warning/25 bg-warning/10 text-yellow-800`;
  return `${base} border-destructive/25 bg-destructive/10 text-destructive`;
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
  const queryClient = useQueryClient();
  const [editingPaymentDetails, setEditingPaymentDetails] = useState(false);
  const { data: accountStatus, isLoading: loadingAccount } = useQuery({
    queryKey: ['payments-account-status', userId],
    queryFn: () => paymentsApi.getAccountStatus(userId),
    enabled: !!userId,
  });

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

  const totalThisMonth = (history || []).reduce((sum, i) => {
    const d = new Date(i.date);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && i.status === 'PAID') {
      return sum + i.amount;
    }
    return sum;
  }, 0);

  const payoutsReady = !!(accountStatus?.hasAccount && accountStatus?.payoutsEnabled);
  const needsSetup = !payoutsReady;
  const profileIncomplete = user?.profileComplete === false;

  const refreshPayments = () => {
    void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
    void queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
    void queryClient.invalidateQueries({ queryKey: ['payments-history', userId] });
    void queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
  };

  if (loadingAccount || loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Payment Settings</h1>
        <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
          Honoraria and survey bonuses are paid through{' '}
          <StripeMark size="sm" className="translate-y-px" /> via <strong>ACH direct deposit only</strong>. Connect
          your bank and tax details here so admins can issue payouts.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link to="/app/earnings" className="font-medium text-foreground underline hover:no-underline">
            Earnings summary and charts
          </Link>
        </p>
      </header>

      {profileIncomplete ? (
        <div className="rounded-card border border-warning/25 bg-warning/10 p-4 text-sm text-amber-950">
          <p className="font-semibold">Complete your profile first</p>
          <p className="mt-1 text-amber-900/90">
            Add your <strong>profession</strong> and <strong>NPI</strong> (when required) under Settings before you can
            connect payouts or request honoraria.
          </p>
          <Link
            to="/app/settings"
            className="mt-3 inline-flex font-semibold text-amber-950 underline hover:no-underline"
          >
            Open Settings
          </Link>
        </div>
      ) : null}

      {needsSetup ? (
        !profileIncomplete ? (
          <StripeConnectOnboarding userId={userId} locked={profileIncomplete} onSuccess={refreshPayments} />
        ) : null
      ) : (
        <div className="space-y-3">
          <div className="rounded-card border border-success/25 bg-success/10/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-success inline-flex flex-wrap items-center gap-2">
                <StripeMark size="sm" /> account ready for ACH payouts
                {accountStatus?.bankAccountLast4
                  ? ` · ••••${accountStatus.bankAccountLast4}`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              disabled={profileIncomplete}
              onClick={() => setEditingPaymentDetails((v) => !v)}
              className="rounded-[6px] border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {editingPaymentDetails ? 'Close' : 'Update bank / tax details'}
            </button>
          </div>
          {editingPaymentDetails && !profileIncomplete ? (
            <StripeConnectOnboarding
              userId={userId}
              locked={profileIncomplete}
              onSuccess={() => {
                setEditingPaymentDetails(false);
                refreshPayments();
              }}
            />
          ) : null}
        </div>
      )}

      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Total paid" value={formatMoney(summary?.availableBalance ?? 0)} sub="Lifetime earnings" />
        <StatCard label="Pending" value={formatMoney(summary?.pendingBalance ?? 0)} sub="Awaiting payout" />
        <StatCard label="This month" value={formatMoney(totalThisMonth)} sub="Paid this month" />
      </section>

      <section className="rounded-card border border-border bg-card p-6 min-w-0 overflow-hidden">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">Payouts</p>
          <p className="text-sm text-muted-foreground">
            Last payout:{' '}
            {summary?.lastPayoutDate ? (
              <span className="font-semibold text-foreground">
                {format(new Date(summary.lastPayoutDate), 'MMM d, yyyy')}
              </span>
            ) : (
              <span className="text-muted-foreground">None yet</span>
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            Funds are deposited by ACH to the bank account on your{' '}
            <StripeMark size="xs" className="translate-y-px" /> Connect account. Paper checks are not supported.
          </p>
        </div>
      </section>

      <section id="payment-history" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Payment history</h2>
          <span className="text-sm text-muted-foreground">{(history || []).length} items</span>
        </div>
        <div className="bg-card border border-border rounded-card overflow-hidden">
          <div className="divide-y divide-border">
            {(history || []).map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>
          {(history || []).length === 0 && (
            <div className="p-10 text-center">
              <p className="font-semibold text-foreground">No payments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Complete activities to start earning.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-card border border-border bg-card p-6">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function HistoryRow({ item }: { item: PaymentItem }) {
  const methodLabel =
    item.deliveryMethod === 'CHECK' || item.method === 'Check'
      ? item.checkStatus
        ? `Check · ${item.checkStatus.replace(/_/g, ' ').toLowerCase()}`
        : 'Check'
      : item.method === 'Bill.com'
        ? 'Stripe ACH'
        : item.method || 'ACH';

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground truncate">{item.title}</p>
        <p className="text-sm text-muted-foreground truncate">
          {format(new Date(item.date), 'MMM d, yyyy')} • {methodLabel}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</span>
        <span className={statusChip(item.status)}>
          {statusIcon(item.status)}
          {item.status}
        </span>
      </div>
    </div>
  );
}
