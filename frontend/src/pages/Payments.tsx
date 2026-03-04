import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { CheckCircle2, AlertCircle, Clock3, Building2 } from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data: accountStatus } = useQuery({
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

  const [bankForm, setBankForm] = useState({
    payeeName: '',
    nameOnAccount: '',
    accountNumber: '',
    routingNumber: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      paymentsApi.createConnectAccount(userId, {
        payeeName: bankForm.payeeName,
        nameOnAccount: bankForm.nameOnAccount,
        accountNumber: bankForm.accountNumber,
        routingNumber: bankForm.routingNumber,
        addressLine1: bankForm.addressLine1 || undefined,
        city: bankForm.city || undefined,
        state: bankForm.state || undefined,
        zipCode: bankForm.zipCode || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
      queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
      setBankForm({ payeeName: '', nameOnAccount: '', accountNumber: '', routingNumber: '', addressLine1: '', city: '', state: '', zipCode: '' });
    },
  });

  const totalThisMonth = (history || []).reduce((sum, i) => {
    const d = new Date(i.date);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && i.status === 'PAID') {
      return sum + i.amount;
    }
    return sum;
  }, 0);

  const needsBankInfo = !accountStatus?.hasAccount;
  const showBankForm = needsBankInfo;

  if (loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-600">
          Add your bank details to receive payouts. Admins process payouts via Bill.com (ACH). W-9 must be on file.
        </p>
      </header>

      {/* In-app bank form (embedded, no external redirect) */}
      {showBankForm && (
        <div className="rounded-3xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl bg-gray-900 p-2.5">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add bank details</h2>
              <p className="text-sm text-gray-600">Enter your information below. You stay on platform—no redirect.</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              connectMutation.mutate();
            }}
          >
            {connectMutation.isError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {String(connectMutation.error)}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Payee name (as on W-9)"
                value={bankForm.payeeName}
                onChange={(v) => setBankForm((f) => ({ ...f, payeeName: v }))}
                required
              />
              <Input
                label="Name on bank account"
                value={bankForm.nameOnAccount}
                onChange={(v) => setBankForm((f) => ({ ...f, nameOnAccount: v }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Routing number"
                value={bankForm.routingNumber}
                onChange={(v) => setBankForm((f) => ({ ...f, routingNumber: v }))}
                placeholder="9 digits"
                required
              />
              <Input
                label="Account number"
                type="password"
                value={bankForm.accountNumber}
                onChange={(v) => setBankForm((f) => ({ ...f, accountNumber: v }))}
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Address line 1"
                value={bankForm.addressLine1}
                onChange={(v) => setBankForm((f) => ({ ...f, addressLine1: v }))}
              />
              <Input
                label="City"
                value={bankForm.city}
                onChange={(v) => setBankForm((f) => ({ ...f, city: v }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="State"
                value={bankForm.state}
                onChange={(v) => setBankForm((f) => ({ ...f, state: v }))}
                placeholder="e.g. CA"
              />
              <Input
                label="ZIP code"
                value={bankForm.zipCode}
                onChange={(v) => setBankForm((f) => ({ ...f, zipCode: v }))}
              />
            </div>
            <button
              type="submit"
              disabled={connectMutation.isPending}
              className="w-full sm:w-auto rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-70"
            >
              {connectMutation.isPending ? 'Saving…' : 'Save bank details'}
            </button>
          </form>
        </div>
      )}

      {/* Connected state */}
      {!showBankInfo && (
        <div className="rounded-3xl border border-green-200 bg-green-50/50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">Bank details on file. You can receive payouts.</p>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard
          label="Total paid"
          value={formatMoney(summary?.availableBalance ?? 0)}
          sub="Lifetime earnings"
        />
        <StatCard
          label="Pending"
          value={formatMoney(summary?.pendingBalance ?? 0)}
          sub="Awaiting payout"
        />
        <StatCard label="This month" value={formatMoney(totalThisMonth)} sub="Paid this month" />
      </section>

      {/* Payout info */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">Payouts</p>
            <p className="text-sm text-gray-600">
              Last payout:{' '}
              <span className="font-semibold text-gray-900">
                {summary?.lastPayoutDate ? format(new Date(summary.lastPayoutDate), 'MMM d, yyyy') : '—'}
              </span>
              {' · '}
              Admins process payouts via Bill.com (ACH). W-9 must be on file.
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

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
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
