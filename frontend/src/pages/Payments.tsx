import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { format } from 'date-fns';
import { W9Modal } from '../components/W9Modal';
import { BillVendorSetupForm } from '../components/payments/BillVendorSetupForm';


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

  const needsBankInfo = !accountStatus?.hasAccount;
  const needsW9 = accountStatus?.hasAccount && !accountStatus?.w9Submitted;
  const profileIncomplete = user?.profileComplete === false;

  // Auto-open W-9 modal when user has bank account but hasn't submitted W-9
  useEffect(() => {
    if (needsW9 && !loadingAccount) {
      const t = setTimeout(() => setW9ModalOpen(true), 100);
      return () => clearTimeout(t);
    }
  }, [needsW9, loadingAccount]);

  if (loadingAccount || loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payment Settings</h1>
        <p className="text-sm text-gray-600">
          Honoraria and survey bonuses are paid via Bill.com. Set up your bank details via Bill.com (ACH or check); admins
          send payouts via Bill.com.
        </p>
        <p className="text-sm text-gray-600">
          <Link to="/app/earnings" className="font-medium text-gray-900 underline hover:no-underline">
            Earnings summary and charts
          </Link>
        </p>
      </header>

      {profileIncomplete ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Complete your profile first</p>
          <p className="mt-1 text-amber-900/90">
            Add your <strong>profession</strong> and <strong>NPI</strong> (when required) under Settings before you can
            save payment details, submit a W-9, or request honoraria.
          </p>
          <Link
            to="/app/settings"
            className="mt-3 inline-flex font-semibold text-amber-950 underline hover:no-underline"
          >
            Open Settings
          </Link>
        </div>
      ) : null}

      {/* Vendor setup form or confirmation */}
      {needsBankInfo ? (
        <BillVendorSetupForm
          userId={userId}
          variant="create"
          locked={profileIncomplete}
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
            void queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
            void queryClient.invalidateQueries({ queryKey: ['payments-history', userId] });
            void queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
            setW9ModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-3">
          <div className="rounded-3xl border border-green-200 bg-green-50/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800">Bill.com vendor on file. You can receive payouts.</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                disabled={profileIncomplete}
                onClick={() => setEditingPaymentDetails((v) => !v)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {editingPaymentDetails ? 'Close editor' : 'Edit payment details'}
              </button>
              <button
                type="button"
                onClick={() => setW9ModalOpen(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {accountStatus?.w9Submitted ? 'Update W-9' : 'Complete W-9'}
              </button>
            </div>
          </div>
          {editingPaymentDetails && !profileIncomplete ? (
            <BillVendorSetupForm
              userId={userId}
              variant="update"
              locked={profileIncomplete}
              onSuccess={() => {
                setEditingPaymentDetails(false);
                void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
                void queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
                void queryClient.invalidateQueries({ queryKey: ['payments-history', userId] });
                void queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
              }}
            />
          ) : null}
          {needsW9 && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900">W-9 required</p>
                  <p className="text-sm text-amber-800">Complete the W-9 form to receive payouts.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setW9ModalOpen(true)}
                className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Complete W-9
              </button>
            </div>
          )}
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
            {summary?.lastPayoutDate ? (
              <span className="font-semibold text-gray-900">
                {format(new Date(summary.lastPayoutDate), 'MMM d, yyyy')}
              </span>
            ) : null}
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
          {accountStatus?.hasAccount && (
            <button
              type="button"
              disabled={profileIncomplete}
              onClick={() => setW9ModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {accountStatus?.w9Submitted ? 'Update W-9' : 'Complete W-9'}
            </button>
          )}
        </div>
        <W9Modal
          isOpen={w9ModalOpen}
          onClose={() => setW9ModalOpen(false)}
          onSubmit={async (data) => {
            if (profileIncomplete) return;
            await paymentsApi.submitW9(userId, data);
            void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
            void queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
            void queryClient.invalidateQueries({ queryKey: ['payments-history', userId] });
            void queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
          }}
          displayName={user?.name || user?.email || 'User'}
        />
      </section>

      {/* History */}
      <section id="payment-history" className="space-y-3">
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
          {format(new Date(item.date), 'MMM d, yyyy')} • {item.method || '-'}
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
