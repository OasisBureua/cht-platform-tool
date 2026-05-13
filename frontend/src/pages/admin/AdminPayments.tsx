import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, type PendingPayment, type FailedPayment } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, AlertCircle, Trash2, Clock, X, Loader2, RefreshCw, XCircle } from 'lucide-react';

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [deleteConfirmPaymentId, setDeleteConfirmPaymentId] = useState<string | null>(null);

  const { data: pending, isLoading } = useQuery({
    queryKey: ['admin', 'pending-payments'],
    queryFn: () => adminApi.getPendingPayments(),
  });

  const { data: failed = [] } = useQuery({
    queryKey: ['admin', 'failed-payments'],
    queryFn: () => adminApi.getFailedPayments(),
  });

  const { data: eligibleNotSubmitted = [] } = useQuery({
    queryKey: ['admin', 'payment-eligible-not-submitted'],
    queryFn: () => adminApi.listPaymentEligibleNotYetRequested(),
  });

  const payNowMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.payNow(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.retryPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
      setDeleteConfirmPaymentId(null);
    },
  });

  const pendingCount = (pending || []).length;
  const pendingTotal = useMemo(
    () => (pending || []).reduce((sum, p) => sum + p.amount, 0),
    [pending],
  );

  // Group failed payments by program (sorted alphabetically; no-program group last)
  const failedByProgram = useMemo(() => {
    const groups = new Map<string, { title: string; programId: string | null; payments: typeof failed }>();
    for (const p of failed) {
      const key = p.program?.id ?? '__none__';
      if (!groups.has(key)) {
        groups.set(key, { title: p.program?.title ?? 'No program', programId: p.program?.id ?? null, payments: [] });
      }
      groups.get(key)!.payments.push(p);
    }
    return [...groups.values()].sort((a, b) => {
      if (a.programId === null) return 1;
      if (b.programId === null) return -1;
      return a.title.localeCompare(b.title);
    });
  }, [failed]);

  if (isLoading) return <LoadingSpinner />;

  const hasPending = (pending || []).length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-600">
            Pending payouts from program completions and survey bonuses. Click <strong>Pay now</strong> on each row to send via Bill.com (ACH or check).
          </p>
        </div>
        <div className="shrink-0">
          <a
            href="#pending-table"
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            <DollarSign className="h-4 w-4" />
            {hasPending ? 'Pay now' : 'View payments'}
          </a>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
        <StatCard label="Pending count" value={String(pendingCount)} sub="Awaiting payout" />
        <StatCard label="Pending total" value={formatMoney(pendingTotal)} sub="To be paid" />
        <StatCard label="Failed payments" value={String(failed.length)} sub="Need admin retry" variant={failed.length > 0 ? 'danger' : 'default'} />
        <StatCard label="Eligible, not submitted" value={String(eligibleNotSubmitted.length)} sub="Survey done, no payment request yet" />
      </section>

      {/* Pending table */}
      <section id="pending-table" className="rounded-3xl border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(pending || []).map((p) => (
                <PendingRow
                  key={p.id}
                  payment={p}
                  onPayNow={() => payNowMutation.mutate(p.id)}
                  onRequestDelete={() => setDeleteConfirmPaymentId(p.id)}
                  isPaying={payNowMutation.isPending && payNowMutation.variables === p.id}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === p.id}
                />
              ))}
            </tbody>
          </table>
        </div>

        {(pending || []).length === 0 && (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-2 font-medium text-gray-900">No pending payments</p>
            <p className="text-sm text-gray-500">All payouts are up to date.</p>
            <p className="mt-4 text-xs text-gray-400">
              Pay now buttons appear in each row when there are pending payments.
            </p>
            {/* Show Pay now button preview when browsing without backend */}
            {import.meta.env.VITE_DISABLE_AUTH === 'true' && (
              <div className="mt-6 pt-6 border-t border-dashed border-gray-200">
                <p className="text-xs font-medium text-gray-500 mb-3">Pay now button (appears per row when there is data):</p>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white cursor-default"
                >
                  <DollarSign className="h-4 w-4" />
                  Pay now
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Failed payments */}
      {failed.length > 0 && (
        <section className="rounded-3xl border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-start gap-3 px-6 pt-5 pb-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-red-900">Failed payments</h2>
              <p className="mt-0.5 text-sm text-red-800">
                These payments failed during processing. Review the failure reason and click <strong>Retry</strong> to attempt payment again via Bill.com.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-red-200 text-sm">
              <thead className="bg-red-100/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-800 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-800 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-800 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-800 uppercase">Failed at</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-red-800 uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-red-800 uppercase whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              {failedByProgram.map((group) => (
                  <tbody key={`group-${group.programId ?? 'none'}`} className="divide-y divide-red-100">
                    <tr className="bg-red-100/40">
                      <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-red-900 tracking-wide uppercase">
                        {group.title}
                        <span className="ml-2 font-normal text-red-700 normal-case">
                          ({group.payments.length} failed)
                        </span>
                      </td>
                    </tr>
                    {group.payments.map((p) => (
                      <FailedRow
                        key={p.id}
                        payment={p}
                        onRetry={() => retryMutation.mutate(p.id)}
                        onRequestDelete={() => setDeleteConfirmPaymentId(p.id)}
                        isRetrying={retryMutation.isPending && retryMutation.variables === p.id}
                        isDeleting={deleteMutation.isPending && deleteMutation.variables === p.id}
                      />
                    ))}
                  </tbody>
              ))}
            </table>
          </div>
          {retryMutation.isError && (
            <div className="flex items-center gap-2 mx-6 mb-4 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {getApiErrorMessage(retryMutation.error, 'Retry failed.')}
            </div>
          )}
        </section>
      )}

      {/* Eligible but not yet submitted for payment */}
      {eligibleNotSubmitted.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="flex items-start gap-3 px-6 pt-5 pb-3">
            <Clock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-amber-900">Not yet submitted for payment</h2>
              <p className="mt-0.5 text-sm text-amber-800">
                These users attended their session and completed the post-event survey, but have not submitted a payment request. Follow up or open their program hub to initiate.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-200 text-sm">
              <thead className="bg-amber-100/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase">Honorarium</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase">Survey completed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-amber-800 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {eligibleNotSubmitted.map((r) => (
                  <tr key={r.id} className="bg-white/70 hover:bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.user.firstName} {r.user.lastName}</p>
                      <p className="text-xs text-gray-500">{r.user.email}</p>
                      {r.user.specialty && <p className="text-xs text-gray-400">{r.user.specialty}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.program.title}</p>
                      <p className="text-xs text-gray-500">{r.program.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {r.program.honorariumAmount ? formatMoney(r.program.honorariumAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.postEventSurveyAcknowledgedAt
                        ? format(new Date(r.postEventSurveyAcknowledgedAt), 'MMM d, yyyy')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/programs/${r.program.id}/hub`}
                        className="text-xs font-semibold text-amber-900 underline hover:text-amber-700"
                      >
                        Open program hub
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {deleteConfirmPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">Delete payment?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  This permanently removes this pending payout row. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmPaymentId(null)}
                className="shrink-0 text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmPaymentId(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirmPaymentId) deleteMutation.mutate(deleteConfirmPaymentId);
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(payNowMutation.isError || deleteMutation.isError) && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {getApiErrorMessage(
            payNowMutation.isError ? payNowMutation.error : deleteMutation.error,
            'Request failed.',
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, variant = 'default' }: { label: string; value: string; sub: string; variant?: 'default' | 'danger' }) {
  const isDanger = variant === 'danger';
  return (
    <div className={['rounded-3xl border p-6', isDanger ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'].join(' ')}>
      <p className={['text-xs font-semibold', isDanger ? 'text-red-700' : 'text-gray-600'].join(' ')}>{label}</p>
      <p className={['mt-2 text-2xl font-semibold', isDanger ? 'text-red-900' : 'text-gray-900'].join(' ')}>{value}</p>
      <p className={['mt-1 text-sm', isDanger ? 'text-red-700' : 'text-gray-600'].join(' ')}>{sub}</p>
    </div>
  );
}

function FailedRow({
  payment,
  onRetry,
  onRequestDelete,
  isRetrying,
  isDeleting,
}: {
  payment: FailedPayment;
  onRetry: () => void;
  onRequestDelete: () => void;
  isRetrying: boolean;
  isDeleting: boolean;
}) {
  const canRetry = !!payment.user.billVendorId;

  return (
    <tr className="bg-white/70 hover:bg-white">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">{payment.user.firstName} {payment.user.lastName}</p>
        <p className="text-xs text-gray-500">{payment.user.email}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-gray-900">{formatMoney(payment.amount)}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{payment.type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {payment.failedAt ? format(new Date(payment.failedAt), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-red-700 max-w-xs">
        <span className="line-clamp-2" title={payment.failureReason ?? undefined}>
          {payment.failureReason ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry || isRetrying}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              canRetry && !isRetrying
                ? 'bg-red-700 text-white hover:bg-red-800'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed',
            ].join(' ')}
          >
            <RefreshCw className={['h-4 w-4', isRetrying ? 'animate-spin' : ''].join(' ')} aria-hidden />
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isDeleting}
            title="Delete payment record"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {!canRetry && (
          <p className="mt-1 text-xs text-amber-600">No Bill.com vendor</p>
        )}
      </td>
    </tr>
  );
}

function PendingRow({
  payment,
  onPayNow,
  onRequestDelete,
  isPaying,
  isDeleting,
}: {
  payment: PendingPayment;
  onPayNow: () => void;
  onRequestDelete: () => void;
  isPaying: boolean;
  isDeleting: boolean;
}) {
  const canPay = !!payment.user.billVendorId;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">
          {payment.user.firstName} {payment.user.lastName}
        </p>
        <p className="text-sm text-gray-500">{payment.user.email}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-gray-900">{formatMoney(payment.amount)}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{payment.type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-3 text-sm text-gray-600">{payment.program?.title ?? '-'}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{format(new Date(payment.createdAt), 'MMM d, yyyy')}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onPayNow}
            disabled={!canPay || isPaying}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              canPay && !isPaying
                ? 'bg-gray-900 text-white hover:bg-black'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed',
            ].join(' ')}
          >
            <DollarSign className="h-4 w-4" aria-hidden />
            {isPaying ? 'Processing…' : 'Pay now'}
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={isDeleting}
            title="Delete (remove test entry)"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {!canPay && (
          <p className="mt-1 text-xs text-amber-600">No Bill.com vendor</p>
        )}
      </td>
    </tr>
  );
}
