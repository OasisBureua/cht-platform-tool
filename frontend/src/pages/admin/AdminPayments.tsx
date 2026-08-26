import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, type PendingPayment, type FailedPayment, type PaidPayment, type AdminUser } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, AlertCircle, Trash2, Clock, X, Loader2, RefreshCw, XCircle, Plus, Download } from 'lucide-react';
import { BillComMark } from '../../components/branding/BillComMark';

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

async function downloadPaymentsCsv(status: 'PENDING' | 'FAILED' | 'PAID' | 'ALL' = 'ALL') {
  const blob = await adminApi.exportPaymentsCsv({ status });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cht-payments-${status.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [deleteConfirmPaymentId, setDeleteConfirmPaymentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const { data: paid = [], isPending: paidPending } = useQuery({
    queryKey: ['admin', 'paid-payments'],
    queryFn: () => adminApi.getPaidPayments({ limit: 200 }),
  });

  const payNowMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.payNow(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'paid-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
    },
    onError: () => {
      // Bill.com failures mark the row FAILED server-side, refresh both lists.
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.retryPayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'paid-payments'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.deletePayment(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'paid-payments'] });
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
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
            Pending payouts from program completions and survey bonuses. Click <strong>Pay now</strong> on each row to send
            through <BillComMark size="sm" className="translate-y-px" /> (ACH or check).
          </p>
        </div>
        <div className="shrink-0 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setExporting(true);
              void downloadPaymentsCsv('ALL')
                .catch((err) => {
                  window.alert(getApiErrorMessage(err, 'CSV export failed.'));
                })
                .finally(() => setExporting(false));
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export CSV
          </button>
          <a
            href="#pending-table"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <DollarSign className="h-4 w-4" />
            {hasPending ? 'Pay now' : 'View payments'}
          </a>
        </div>
      </header>

      {/* Summary cards */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Pending count" value={String(pendingCount)} sub="Awaiting payout" />
        <StatCard label="Pending total" value={formatMoney(pendingTotal)} sub="To be paid" />
        <StatCard
          label="Paid (recent)"
          value={paidPending ? '…' : String(paid.length)}
          sub="Latest 200 completed"
          variant="success"
        />
        <StatCard label="Failed payments" value={String(failed.length)} sub="Need admin retry" variant={failed.length > 0 ? 'danger' : 'default'} />
        <StatCard label="Eligible, not submitted" value={String(eligibleNotSubmitted.length)} sub="Survey done, no payment request yet" />
      </section>

      <ManualPaymentForm />

      {/* Pending table */}
      <section id="pending-table" className="rounded-card border border-border bg-card overflow-hidden">
        {(payNowMutation.isError || deleteMutation.isError) && (
          <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Pay now failed</p>
              <p>
                {getApiErrorMessage(
                  payNowMutation.isError ? payNowMutation.error : deleteMutation.error,
                  'Request failed.',
                )}
              </p>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(pending || []).map((p) => (
                <PendingRow
                  key={p.id}
                  payment={p}
                  onPayNow={() => payNowMutation.mutate(p.id)}
                  onRequestDelete={() => setDeleteConfirmPaymentId(p.id)}
                  isPaying={payNowMutation.isPending && payNowMutation.variables === p.id}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === p.id}
                  payError={
                    payNowMutation.isError && payNowMutation.variables === p.id
                      ? getApiErrorMessage(payNowMutation.error, 'Pay now failed.')
                      : null
                  }
                />
              ))}
            </tbody>
          </table>
        </div>

        {(pending || []).length === 0 && (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-2 font-medium text-foreground">No pending payments</p>
            <p className="text-sm text-muted-foreground">All payouts are up to date.</p>
            <p className="mt-4 text-xs text-muted-foreground">
              Pay now buttons appear in each row when there are pending payments.
            </p>
            {/* Show Pay now button preview when browsing without backend */}
            {import.meta.env.VITE_DISABLE_AUTH === 'true' && (
              <div className="mt-6 pt-6 border-t border-dashed border-border">
                <p className="text-xs font-medium text-muted-foreground mb-3">Pay now button (appears per row when there is data):</p>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white cursor-default"
                >
                  <DollarSign className="h-4 w-4" />
                  Pay now
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Successful payouts (recent) */}
      <section className="rounded-card border border-green-200 bg-green-50/40 overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-5 pb-3 border-b border-green-100 bg-green-50/80">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-700 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-green-950">Successful payments</h2>
            <p className="mt-0.5 text-sm text-green-900">
              Recent payouts completed through <BillComMark size="xs" className="translate-y-px" /> (newest first, up to 200).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto bg-white">
          <table className="min-w-full divide-y divide-green-100 text-sm">
            <thead className="bg-green-50/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Method / delivery</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Paid on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paidPending ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Loading paid payments…
                  </td>
                </tr>
              ) : paid.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    No completed payouts yet. Successful payments appear here after <strong>Pay now</strong> finishes.
                  </td>
                </tr>
              ) : (
                paid.map((p) => <PaidRow key={p.id} payment={p} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Failed payments */}
      {failed.length > 0 && (
        <section className="rounded-card border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-start gap-3 px-6 pt-5 pb-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-red-900">Failed payments</h2>
              <p className="mt-0.5 text-sm text-red-800 flex flex-wrap items-center gap-x-1 gap-y-1">
                These payments failed during processing. Review the failure reason and click <strong>Retry</strong> to try
                again through <BillComMark size="xs" className="translate-y-px" />.
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
        <section className="rounded-card border border-amber-200 bg-amber-50 overflow-hidden">
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
                      {r.program.honorariumAmount ? formatMoney(r.program.honorariumAmount) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.postEventSurveyAcknowledgedAt
                        ? format(new Date(r.postEventSurveyAcknowledgedAt), 'MMM d, yyyy')
                        : '-'}
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
          <div className="w-full max-w-sm rounded-card bg-card p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground">Delete payment?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This permanently removes this pending payout row. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteConfirmPaymentId(null)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteConfirmPaymentId(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
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
    </div>
  );
}

function ManualPaymentForm() {
  const queryClient = useQueryClient();
  const [userQuery, setUserQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [programId, setProgramId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [description, setDescription] = useState('');
  const [paymentType, setPaymentType] = useState<
    'HONORARIUM' | 'CME_COMPLETION' | 'SURVEY_BONUS' | 'REFERRAL'
  >('HONORARIUM');
  const [formError, setFormError] = useState<string | null>(null);
  const [eligibilityConfirm, setEligibilityConfirm] = useState<{
    warnings: string[];
    programTitle: string;
  } | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const { data: users = [], isFetching: usersLoading } = useQuery({
    queryKey: ['admin', 'users', 'manual-payment', userQuery],
    queryFn: () => adminApi.getUsers({ q: userQuery.trim(), limit: 20 }),
    enabled: userQuery.trim().length >= 2,
  });

  const { data: programs = [] } = useQuery({
    queryKey: ['admin', 'programs'],
    queryFn: () => adminApi.getPrograms(),
  });

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId),
    [users, selectedUserId],
  );

  const createMut = useMutation({
    mutationFn: () => {
      const parsed = parseFloat(amountDollars);
      if (!selectedUserId) throw new Error('Select a user.');
      if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter a valid amount.');
      const cents = Math.round(parsed * 100);
      if (cents < 1) throw new Error('Amount must be at least $0.01.');
      return adminApi.createManualPayment({
        userId: selectedUserId,
        programId: programId || undefined,
        amount: cents,
        description: description.trim() || undefined,
        type: paymentType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      setUserQuery('');
      setSelectedUserId('');
      setProgramId('');
      setAmountDollars('');
      setDescription('');
      setPaymentType('HONORARIUM');
      setFormError(null);
      setEligibilityConfirm(null);
    },
    onError: (err) => {
      setFormError(getApiErrorMessage(err, 'Could not create payment.'));
      setEligibilityConfirm(null);
    },
  });

  const submitPayment = () => {
    setFormError(null);
    createMut.mutate();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setEligibilityConfirm(null);

    // Warn only for honorarium + program when Pay-now eligibility is incomplete.
    if (paymentType === 'HONORARIUM' && programId && selectedUserId) {
      setCheckingEligibility(true);
      try {
        const eligibility = await adminApi.getManualPaymentEligibility({
          userId: selectedUserId,
          programId,
        });
        if (!eligibility.payNowReady) {
          setEligibilityConfirm({
            warnings:
              eligibility.warnings.length > 0
                ? eligibility.warnings
                : [
                    'Attendance, survey, Bill.com vendor, or W-9 requirements are not complete yet.',
                  ],
            programTitle: eligibility.programTitle,
          });
          return;
        }
      } catch (err) {
        setFormError(
          getApiErrorMessage(err, 'Could not check attendance / survey status.'),
        );
        return;
      } finally {
        setCheckingEligibility(false);
      }
    }

    submitPayment();
  };

  return (
    <section className="rounded-card border border-border bg-card p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Plus className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-foreground">Add manual payment</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Queue a pending payout for a specific user and program. It appears in the table below for{' '}
            <strong>Pay now</strong> when you are ready. Honorarium + program still requires attendance
            verified and survey ack before Pay now succeeds.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 lg:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">User</label>
          <input
            type="search"
            value={userQuery}
            onChange={(e) => {
              setUserQuery(e.target.value);
              setSelectedUserId('');
            }}
            placeholder="Search by name or email (min 2 characters)"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
          {usersLoading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
          {userQuery.trim().length >= 2 && users.length > 0 ? (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-gray-100">
              {users.map((u: AdminUser) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(u.id);
                      setUserQuery(`${u.firstName} ${u.lastName} (${u.email})`);
                    }}
                    className={[
                      'w-full px-3 py-2 text-left text-sm hover:bg-muted',
                      selectedUserId === u.id ? 'bg-brand-50 font-semibold' : '',
                    ].join(' ')}
                  >
                    {u.firstName} {u.lastName}
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedUser ? (
            <p className="text-xs text-green-800">Selected: {selectedUser.email}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Program</label>
          <select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">No program (optional)</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount (USD)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="250.00"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</label>
          <select
            value={paymentType}
            onChange={(e) =>
              setPaymentType(
                e.target.value as 'HONORARIUM' | 'CME_COMPLETION' | 'SURVEY_BONUS' | 'REFERRAL',
              )
            }
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="HONORARIUM">Honorarium</option>
            <option value="CME_COMPLETION">CME completion</option>
            <option value="SURVEY_BONUS">Survey bonus</option>
            <option value="REFERRAL">Referral</option>
          </select>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Manual honorarium adjustment"
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            maxLength={500}
          />
        </div>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={createMut.isPending || checkingEligibility || !selectedUserId}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {createMut.isPending || checkingEligibility ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {checkingEligibility ? 'Checking eligibility…' : 'Add to pending queue'}
          </button>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </div>
      </form>

      {eligibilityConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-pay-eligibility-title"
            className="w-full max-w-md rounded-card bg-card p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning mt-0.5" aria-hidden />
              <div>
                <h3 id="manual-pay-eligibility-title" className="font-semibold text-foreground">
                  Eligibility incomplete: add anyway?
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  This person is not fully ready for Pay now on{' '}
                  <strong>{eligibilityConfirm.programTitle}</strong>. You can still queue the
                  payment, but Pay now will fail until attendance, survey, Bill.com vendor, and W-9
                  requirements are met.
                </p>
                <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-amber-900">
                  {eligibilityConfirm.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEligibilityConfirm(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPayment}
                disabled={createMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add to pending anyway
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({
  label,
  value,
  sub,
  variant = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  variant?: 'default' | 'danger' | 'success';
}) {
  const shell =
    variant === 'danger'
      ? 'border-red-200 bg-red-50'
      : variant === 'success'
        ? 'border-green-200 bg-green-50/80'
        : 'border-gray-200 bg-white';
  const labelCls =
    variant === 'danger' ? 'text-red-700' : variant === 'success' ? 'text-green-800' : 'text-gray-600';
  const valueCls =
    variant === 'danger' ? 'text-red-900' : variant === 'success' ? 'text-green-950' : 'text-gray-900';
  const subCls =
    variant === 'danger' ? 'text-red-700' : variant === 'success' ? 'text-green-800' : 'text-gray-600';

  return (
    <div className={['rounded-card border p-6', shell].join(' ')}>
      <p className={['text-xs font-semibold', labelCls].join(' ')}>{label}</p>
      <p className={['mt-2 text-2xl font-semibold', valueCls].join(' ')}>{value}</p>
      <p className={['mt-1 text-sm', subCls].join(' ')}>{sub}</p>
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
        {payment.failedAt ? format(new Date(payment.failedAt), 'MMM d, yyyy') : '-'}
      </td>
      <td className="px-4 py-3 text-xs text-red-700 max-w-xs">
        <span className="line-clamp-2" title={payment.failureReason ?? undefined}>
          {payment.failureReason ?? '-'}
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
          <p className="mt-1 text-xs text-amber-600 flex flex-wrap items-center gap-1">
            No <BillComMark size="xs" /> vendor
          </p>
        )}
      </td>
    </tr>
  );
}

function PaidRow({ payment }: { payment: PaidPayment }) {
  const paidLabel =
    payment.paidAt != null && payment.paidAt !== ''
      ? format(new Date(payment.paidAt), 'MMM d, yyyy · h:mm a')
      : '-';

  const method =
    payment.deliveryMethod === 'CHECK' || payment.user.preferredPaymentMethod === 'CHECK'
      ? 'Check'
      : payment.deliveryMethod === 'ACH' || payment.user.preferredPaymentMethod === 'ACH'
        ? 'ACH'
        : '—';
  const delivery =
    method === 'Check' && payment.checkStatus
      ? `${method} · ${payment.checkStatus.replace(/_/g, ' ').toLowerCase()}`
      : method;

  return (
    <tr className="hover:bg-gray-50/80">
      <td className="px-4 py-3">
        <p className="font-medium text-gray-900">
          {payment.user.firstName} {payment.user.lastName}
        </p>
        <p className="text-sm text-gray-500">{payment.user.email}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-gray-900">{formatMoney(payment.amount)}</td>
      <td className="px-4 py-3 text-gray-600">{payment.type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-3 text-gray-600">
        <p>{delivery}</p>
        {payment.checkMailedAt ? (
          <p className="text-xs text-gray-500">
            Mailed {format(new Date(payment.checkMailedAt), 'MMM d, yyyy')}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 text-gray-600">{payment.program?.title ?? '-'}</td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{paidLabel}</td>
    </tr>
  );
}

function PendingRow({
  payment,
  onPayNow,
  onRequestDelete,
  isPaying,
  isDeleting,
  payError,
}: {
  payment: PendingPayment;
  onPayNow: () => void;
  onRequestDelete: () => void;
  isPaying: boolean;
  isDeleting: boolean;
  payError?: string | null;
}) {
  const hasVendor = !!payment.user.billVendorId;
  const hasW9 = payment.user.w9Submitted !== false;
  const canPay = hasVendor && hasW9;
  const blockReason = !hasVendor
    ? 'No Bill.com vendor: HCP must complete payment setup (ACH or check)'
    : !hasW9
      ? 'W-9 not submitted: HCP must complete W-9 first'
      : null;

  const methodLabel =
    payment.user.preferredPaymentMethod === 'CHECK'
      ? 'Check'
      : payment.user.preferredPaymentMethod === 'ACH'
        ? `ACH${payment.user.bankAccountLast4 ? ` · ••••${payment.user.bankAccountLast4}` : ''}`
        : '—';

  return (
    <tr className="hover:bg-muted">
      <td className="px-4 py-3">
        <p className="font-medium text-foreground">
          {payment.user.firstName} {payment.user.lastName}
        </p>
        <p className="text-sm text-muted-foreground">{payment.user.email}</p>
      </td>
      <td className="px-4 py-3 font-semibold text-foreground">{formatMoney(payment.amount)}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{payment.type.replace(/_/g, ' ')}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{methodLabel}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{payment.program?.title ?? '-'}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{format(new Date(payment.createdAt), 'MMM d, yyyy')}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onPayNow}
            disabled={!canPay || isPaying}
            title={blockReason ?? 'Send payout via Bill.com'}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              canPay && !isPaying
                ? 'bg-brand-600 text-white hover:bg-brand-700'
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
            className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {blockReason ? (
          <p className="mt-1 text-xs text-warning text-right">{blockReason}</p>
        ) : null}
        {payError ? (
          <p className="mt-1 text-xs text-destructive text-right max-w-xs ml-auto">{payError}</p>
        ) : null}
      </td>
    </tr>
  );
}
