import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, type PendingPayment } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, AlertCircle, Trash2, Clock } from 'lucide-react';

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AdminPayments() {
  const queryClient = useQueryClient();

  const { data: pending, isLoading } = useQuery({
    queryKey: ['admin', 'pending-payments'],
    queryFn: () => adminApi.getPendingPayments(),
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

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
    },
  });

  const pendingCount = (pending || []).length;
  const pendingTotal = useMemo(
    () => (pending || []).reduce((sum, p) => sum + p.amount, 0),
    [pending],
  );

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
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Pending count" value={String(pendingCount)} sub="Awaiting payout" />
        <StatCard label="Pending total" value={formatMoney(pendingTotal)} sub="To be paid" />
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
                  onDelete={() => deleteMutation.mutate(p.id)}
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

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{sub}</p>
    </div>
  );
}

function PendingRow({
  payment,
  onPayNow,
  onDelete,
  isPaying,
  isDeleting,
}: {
  payment: PendingPayment;
  onPayNow: () => void;
  onDelete: () => void;
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
            onClick={onDelete}
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
