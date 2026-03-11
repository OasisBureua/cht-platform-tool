import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { CheckCircle2, AlertCircle, Clock3, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { W9Modal } from '../components/W9Modal';


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
  const [w9ModalOpen, setW9ModalOpen] = useState(false);
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

  const needsBankInfo = !accountStatus?.hasAccount;
  const needsW9 = accountStatus?.hasAccount && !accountStatus?.w9Submitted;

  if (loadingAccount || loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-600">
          Set up your bank details to receive payouts via ACH. Admins process payments via Bill.com.
        </p>
      </header>

      {/* Vendor setup form or confirmation */}
      {needsBankInfo ? (
        <VendorSetupForm
          userId={userId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
            queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
          }}
        />
      ) : (
        <div className="rounded-3xl border border-green-200 bg-green-50/50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">Bank details on file. You can receive payouts.</p>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Total paid" value={formatMoney(summary?.availableBalance ?? 0)} sub="Lifetime earnings" />
        <StatCard label="Pending" value={formatMoney(summary?.pendingBalance ?? 0)} sub="Awaiting payout" />
        <StatCard label="This month" value={formatMoney(totalThisMonth)} sub="Paid this month" />
      </section>

      {/* Payout info */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6 min-w-0 overflow-hidden">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">Payouts</p>
          <p className="text-sm text-gray-600">
            Last payout:{' '}
            <span className="font-semibold text-gray-900">
              {summary?.lastPayoutDate ? format(new Date(summary.lastPayoutDate), 'MMM d, yyyy') : '—'}
            </span>
            {' · '}
            Admins process payouts via Bill.com (ACH).
          </p>
          {needsW9 && (
            <button
              type="button"
              onClick={() => setW9ModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              <AlertCircle className="h-4 w-4" />
              Complete W-9 to receive payouts
            </button>
          )}
        </div>
        <W9Modal
          isOpen={w9ModalOpen}
          onClose={() => setW9ModalOpen(false)}
          onSubmit={async (data) => {
            await paymentsApi.submitW9(userId, data);
            queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
          }}
          displayName={user?.name || user?.email || 'User'}
        />
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
          {(history || []).length === 0 && (
            <div className="p-10 text-center">
              <p className="font-semibold text-gray-900">No payments yet</p>
              <p className="mt-1 text-sm text-gray-600">Complete activities to start earning.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function VendorSetupForm({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    payeeName: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
    nameOnAccount: '',
    accountNumber: '',
    routingNumber: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => paymentsApi.createConnectAccount(userId, form),
    onSuccess: () => onSuccess(),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to save payment details.';
      setError(msg);
    },
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.payeeName.trim()) return setError('Payee name is required.');
    if (!form.addressLine1.trim()) return setError('Address is required.');
    if (!form.city.trim()) return setError('City is required.');
    if (!form.state.trim()) return setError('State is required.');
    if (!/^\d{5}(-\d{4})?$/.test(form.zipCode.trim())) return setError('Enter a valid ZIP code.');
    if (!form.nameOnAccount.trim()) return setError('Name on account is required.');
    if (!/^\d{9}$/.test(form.routingNumber.trim())) return setError('Routing number must be 9 digits.');
    if (form.accountNumber.trim().length < 4) return setError('Account number is required.');
    mutation.mutate();
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts?: { placeholder?: string; maxLength?: number; type?: string },
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={set(key)}
        placeholder={opts?.placeholder}
        maxLength={opts?.maxLength}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        disabled={mutation.isPending}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-200 bg-white p-6 space-y-6 min-w-0 overflow-hidden">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Set up your payment account</h2>
        <p className="mt-0.5 text-sm text-gray-600">
          Enter your US bank details to receive ACH payouts via Bill.com.
        </p>
      </div>

      {/* Payee info */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payee information</legend>
        {field('Payee name (as it appears on checks)', 'payeeName', { placeholder: 'Dr. Jane Smith' })}
      </fieldset>

      {/* Address */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">US address</legend>
        {field('Street address', 'addressLine1', { placeholder: '123 Main St' })}
        <div className="grid grid-cols-2 gap-3">
          {field('City', 'city', { placeholder: 'New York' })}
          {field('State', 'state', { placeholder: 'NY', maxLength: 2 })}
        </div>
        {field('ZIP code', 'zipCode', { placeholder: '10001', maxLength: 10 })}
      </fieldset>

      {/* Bank account */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bank account (ACH)</legend>
        {field('Name on account', 'nameOnAccount', { placeholder: 'Jane Smith' })}
        {field('Routing number', 'routingNumber', { placeholder: '9-digit ABA number', maxLength: 9 })}
        {field('Account number', 'accountNumber', { placeholder: 'Checking or savings', type: 'password' })}
      </fieldset>

      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mutation.isPending ? 'Saving…' : 'Save payment details'}
      </button>
    </form>
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
