import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, type PendingPayment, type FailedPayment, type PaidPayment, type AdminUser } from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, AlertCircle, Trash2, Clock, X, Loader2, RefreshCw, XCircle, Plus, Download } from 'lucide-react';
import { StripeMark } from '../../components/branding/StripeMark';

function formatMoney(cents: number) {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeAmountCents(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  return Number.isFinite(n) ? n : 0;
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

function paymentUserLabel(p: {
  user?: { email?: string | null; firstName?: string | null; lastName?: string | null } | null;
}) {
  if (!p.user) return '';
  return `${p.user.firstName ?? ''} ${p.user.lastName ?? ''} ${p.user.email ?? ''}`.toLowerCase();
}

function matchesUserQuery(
  p: {
    user?: { email?: string | null; firstName?: string | null; lastName?: string | null } | null;
  },
  q: string,
) {
  if (!q.trim()) return true;
  if (!p.user) return false;
  return paymentUserLabel(p).includes(q.trim().toLowerCase());
}

function resolveProgramId(p: {
  programId?: string | null;
  program?: { id?: string | null } | null;
}): string | null {
  const id = (p.program?.id || p.programId || '').trim();
  return id || null;
}

function matchesProgramFilter(
  p: { programId?: string | null; program?: { id?: string | null } | null },
  programFilter: string,
) {
  if (programFilter === 'all') return true;
  const id = resolveProgramId(p);
  if (programFilter === 'none') return id === null;
  return id === programFilter;
}

type EligibleNotSubmittedRow = Awaited<
  ReturnType<typeof adminApi.listPaymentEligibleNotYetRequested>
>[number];

type ProgramPaymentGroup = {
  key: string;
  programId: string | null;
  title: string;
  chmProgramId: string | null;
  sponsorName: string | null;
  pending: PendingPayment[];
  paid: PaidPayment[];
  failed: FailedPayment[];
  eligible: EligibleNotSubmittedRow[];
  pendingTotalCents: number;
  paidTotalCents: number;
  failedTotalCents: number;
};

const NO_PROGRAM_KEY = '__none__';

function resolveProgramMeta(p: {
  programId?: string | null;
  program?: {
    id?: string | null;
    title?: string | null;
    chmProgramId?: string | null;
    sponsorName?: string | null;
  } | null;
}): {
  key: string;
  programId: string | null;
  title: string;
  chmProgramId: string | null;
  sponsorName: string | null;
} {
  const programId = resolveProgramId(p);
  const title =
    p.program?.title?.trim() || (programId ? 'Untitled program' : 'No program');
  return {
    key: programId ?? NO_PROGRAM_KEY,
    programId,
    title,
    chmProgramId: p.program?.chmProgramId?.trim() || null,
    sponsorName: p.program?.sponsorName?.trim() || null,
  };
}

function emptyProgramGroup(
  key: string,
  meta: {
    programId: string | null;
    title: string;
    chmProgramId: string | null;
    sponsorName: string | null;
  },
): ProgramPaymentGroup {
  return {
    key,
    programId: meta.programId,
    title: meta.title,
    chmProgramId: meta.chmProgramId,
    sponsorName: meta.sponsorName,
    pending: [],
    paid: [],
    failed: [],
    eligible: [],
    pendingTotalCents: 0,
    paidTotalCents: 0,
    failedTotalCents: 0,
  };
}

function buildProgramPaymentGroups(input: {
  pending: PendingPayment[];
  paid: PaidPayment[];
  failed: FailedPayment[];
  eligible: EligibleNotSubmittedRow[];
}): ProgramPaymentGroup[] {
  const groups = new Map<string, ProgramPaymentGroup>();

  const ensure = (meta: ReturnType<typeof resolveProgramMeta>) => {
    let group = groups.get(meta.key);
    if (!group) {
      group = emptyProgramGroup(meta.key, meta);
      groups.set(meta.key, group);
    } else if (group.title === 'Untitled program' && meta.title !== 'Untitled program') {
      // Prefer a real title if a later row has the joined program.
      group.title = meta.title;
      group.chmProgramId = group.chmProgramId ?? meta.chmProgramId;
      group.sponsorName = group.sponsorName ?? meta.sponsorName;
    }
    return group;
  };

  for (const p of input.pending) {
    if (!p || typeof p !== 'object') continue;
    const group = ensure(resolveProgramMeta(p));
    group.pending.push(p);
    group.pendingTotalCents += safeAmountCents(p.amount);
  }

  for (const p of input.paid) {
    if (!p || typeof p !== 'object') continue;
    const group = ensure(resolveProgramMeta(p));
    group.paid.push(p);
    group.paidTotalCents += safeAmountCents(p.amount);
  }

  for (const p of input.failed) {
    if (!p || typeof p !== 'object') continue;
    const group = ensure(resolveProgramMeta(p));
    group.failed.push(p);
    group.failedTotalCents += safeAmountCents(p.amount);
  }

  for (const r of input.eligible) {
    if (!r || typeof r !== 'object') continue;
    const group = ensure(resolveProgramMeta({ program: r.program, programId: r.program?.id }));
    group.eligible.push(r);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.programId === null) return 1;
    if (b.programId === null) return -1;
    return a.title.localeCompare(b.title);
  });
}

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [deleteConfirmPaymentId, setDeleteConfirmPaymentId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  /** Single program selection: 'all' | 'none' | programId */
  const [programFilter, setProgramFilter] = useState('all');

  const { data: pendingData, isLoading } = useQuery({
    queryKey: ['admin', 'pending-payments'],
    queryFn: () => adminApi.getPendingPayments(),
  });

  const { data: failedData } = useQuery({
    queryKey: ['admin', 'failed-payments'],
    queryFn: () => adminApi.getFailedPayments(),
  });

  const { data: eligibleData } = useQuery({
    queryKey: ['admin', 'payment-eligible-not-submitted'],
    queryFn: () => adminApi.listPaymentEligibleNotYetRequested(),
  });

  const { data: paidData, isPending: paidPending } = useQuery({
    queryKey: ['admin', 'paid-payments'],
    queryFn: () => adminApi.getPaidPayments({ limit: 200 }),
  });

  // Normalize null/non-array API payloads so grouping never throws.
  const pending = asArray(pendingData);
  const failed = asArray(failedData);
  const eligibleNotSubmitted = asArray(eligibleData);
  const paid = asArray(paidData);

  const userFilteredPending = useMemo(
    () => pending.filter((p) => matchesUserQuery(p, userFilter)),
    [pending, userFilter],
  );
  const userFilteredPaid = useMemo(
    () => paid.filter((p) => matchesUserQuery(p, userFilter)),
    [paid, userFilter],
  );
  const userFilteredFailed = useMemo(
    () => failed.filter((p) => matchesUserQuery(p, userFilter)),
    [failed, userFilter],
  );
  const userFilteredEligible = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return eligibleNotSubmitted;
    return eligibleNotSubmitted.filter((r) => matchesUserQuery(r, userFilter));
  }, [eligibleNotSubmitted, userFilter]);

  const programGroups = useMemo(
    () =>
      buildProgramPaymentGroups({
        pending: userFilteredPending,
        paid: userFilteredPaid,
        failed: userFilteredFailed,
        eligible: userFilteredEligible,
      }),
    [userFilteredPending, userFilteredPaid, userFilteredFailed, userFilteredEligible],
  );

  const selectedProgramGroup = useMemo(() => {
    if (programFilter === 'all') return null;
    if (programFilter === 'none') {
      return programGroups.find((g) => g.programId === null) ?? null;
    }
    return programGroups.find((g) => g.programId === programFilter) ?? null;
  }, [programFilter, programGroups]);

  const filteredPending = useMemo(
    () => userFilteredPending.filter((p) => matchesProgramFilter(p, programFilter)),
    [userFilteredPending, programFilter],
  );

  const filteredPaid = useMemo(
    () => userFilteredPaid.filter((p) => matchesProgramFilter(p, programFilter)),
    [userFilteredPaid, programFilter],
  );

  const filteredFailed = useMemo(
    () => userFilteredFailed.filter((p) => matchesProgramFilter(p, programFilter)),
    [userFilteredFailed, programFilter],
  );

  const filteredEligible = useMemo(() => {
    return userFilteredEligible.filter((r) =>
      matchesProgramFilter({ program: r.program, programId: r.program?.id }, programFilter),
    );
  }, [userFilteredEligible, programFilter]);

  const payNowMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.payNow(paymentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'paid-payments'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
    },
    onError: () => {
      // Payout failures mark the row FAILED server-side, refresh both lists.
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

  const pendingCount = pending.length;
  const pendingTotal = useMemo(
    () => pending.reduce((sum, p) => sum + safeAmountCents(p.amount), 0),
    [pending],
  );

  const isProgramDrillDown = programFilter !== 'all';
  const showPaymentDetails = isProgramDrillDown;

  if (isLoading) return <LoadingSpinner />;

  const hasPending = filteredPending.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground">Payments</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
            Review payouts by program, then drill down to Pending, Paid, Failed, and Eligible rows. Click{' '}
            <strong>Pay now</strong> on a pending row to send through{' '}
            <StripeMark size="sm" className="translate-y-px" /> (ACH direct deposit only).
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
          {showPaymentDetails ? (
            <a
              href="#pending-table"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <DollarSign className="h-4 w-4" />
              {hasPending ? 'Pay now' : 'View payments'}
            </a>
          ) : (
            <a
              href="#program-summary"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <DollarSign className="h-4 w-4" />
              Select a program
            </a>
          )}
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

      <section className="rounded-card border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="admin-payments-user-filter" className="text-xs font-semibold text-muted-foreground">
              Filter by user
            </label>
            <input
              id="admin-payments-user-filter"
              type="search"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="Name or email"
              className="mt-1 h-10 w-full rounded-[6px] border border-border bg-card px-3 text-sm text-foreground"
            />
          </div>
          {(userFilter || programFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setUserFilter('');
                setProgramFilter('all');
              }}
              className="h-10 rounded-[6px] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Clear filters
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isProgramDrillDown
            ? `Drill-down: ${filteredPending.length} pending · ${filteredPaid.length} paid · ${filteredFailed.length} failed · ${filteredEligible.length} eligible`
            : `${programGroups.length} program group${programGroups.length === 1 ? '' : 's'} · select a row to drill down`}
          {userFilter ? ' (user filtered)' : ''}
        </p>
      </section>

      {/* Program summary — click a row to drill down */}
      <section
        id="program-summary"
        className="rounded-card border border-border bg-card overflow-hidden"
      >
        <div className="flex flex-col gap-2 px-6 pt-5 pb-3 border-b border-border sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Programs</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Select a program to view its Pending, Paid, Failed, and Eligible payments. Paid counts use
              the recent paid list (up to 200).
            </p>
          </div>
          {isProgramDrillDown ? (
            <button
              type="button"
              onClick={() => setProgramFilter('all')}
              className="shrink-0 h-9 rounded-[6px] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              All programs
            </button>
          ) : null}
        </div>
        {programGroups.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted-foreground text-center">
            No payment activity by program{userFilter ? ' for this user filter' : ''}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Program
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Pending
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Failed
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Eligible
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {programGroups.map((group) => {
                  const selectValue = group.programId ?? 'none';
                  const selected =
                    programFilter === selectValue ||
                    (programFilter === 'none' && group.programId === null);
                  return (
                    <tr
                      key={group.key}
                      className={[
                        'cursor-pointer transition-colors',
                        selected ? 'bg-brand-50' : 'hover:bg-muted/60',
                      ].join(' ')}
                      onClick={() => setProgramFilter(selectValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setProgramFilter(selectValue);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={selected}
                      aria-label={`Open payments for ${group.title}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{group.title}</p>
                        {group.chmProgramId ? (
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {group.chmProgramId}
                          </p>
                        ) : null}
                        {group.sponsorName ? (
                          <p className="text-xs text-muted-foreground">{group.sponsorName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-foreground">{group.pending.length}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(group.pendingTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-foreground">{group.paid.length}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(group.paidTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p
                          className={[
                            'font-semibold',
                            group.failed.length > 0 ? 'text-destructive' : 'text-foreground',
                          ].join(' ')}
                        >
                          {group.failed.length}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(group.failedTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {group.eligible.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isProgramDrillDown ? (
        <div className="rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedProgramGroup?.title ??
                (programFilter === 'none' ? 'No program' : 'Selected program')}
            </p>
            <p className="text-xs text-muted-foreground">
              Showing this program&apos;s Pending, Paid, Failed, and Eligible rows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setProgramFilter('all')}
            className="h-9 rounded-[6px] border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back to all programs
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Select a program above to drill down into its payment lists.
        </p>
      )}

      {showPaymentDetails ? (
      <>
      {/* Pending table */}
      <section id="pending-table" className="rounded-card border border-border bg-card overflow-hidden">
        {(payNowMutation.isError || deleteMutation.isError) && (
          <div className="flex items-start gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Campaign / ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPending.map((p) => (
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

        {filteredPending.length === 0 && (
          <div className="px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-2 font-medium text-foreground">
              {pending.length === 0
                ? 'No pending payments'
                : 'No pending payments for this program'}
            </p>
            <p className="text-sm text-muted-foreground">
              {pending.length === 0
                ? 'All payouts are up to date.'
                : 'Try another program or clear the user filter.'}
            </p>
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
      <section className="rounded-card border border-success/25 bg-success/10/40 overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-5 pb-3 border-b border-green-100 bg-success/10/80">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-green-950">Successful payments</h2>
            <p className="mt-0.5 text-sm text-green-900">
              Recent payouts completed through <StripeMark size="xs" className="translate-y-px" /> (newest first, up to 200).
            </p>
          </div>
        </div>
        <div className="overflow-x-auto bg-white">
          <table className="min-w-full divide-y divide-green-100 text-sm">
            <thead className="bg-success/10/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Method / delivery</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Program</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Campaign / ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Paid on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paidPending ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Loading paid payments…
                  </td>
                </tr>
              ) : filteredPaid.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {paid.length === 0
                      ? (
                        <>
                          No completed payouts yet. Successful payments appear here after <strong>Pay now</strong>{' '}
                          finishes.
                        </>
                        )
                      : (
                        'No paid payments for this program in the recent paid list.'
                      )}
                  </td>
                </tr>
              ) : (
                filteredPaid.map((p) => <PaidRow key={p.id} payment={p} />)
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Failed payments — only when this program has failures (same idea as pre-drill-down). */}
      {filteredFailed.length > 0 && (
        <section className="rounded-card border border-destructive/25 bg-destructive/10 overflow-hidden">
          <div className="flex items-start gap-3 px-6 pt-5 pb-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-red-900">Failed payments</h2>
              <p className="mt-0.5 text-sm text-destructive flex flex-wrap items-center gap-x-1 gap-y-1">
                These payments failed during processing. Review the failure reason and click <strong>Retry</strong> to try
                again through <StripeMark size="xs" className="translate-y-px" />.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-red-200 text-sm">
              <thead className="bg-red-100/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-destructive uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-destructive uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-destructive uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-destructive uppercase">Failed at</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-destructive uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-destructive uppercase whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {filteredFailed.map((p) => (
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
            </table>
          </div>
          {retryMutation.isError && (
            <div className="flex items-center gap-2 mx-6 mb-4 rounded-lg border border-red-300 bg-white px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {getApiErrorMessage(retryMutation.error, 'Retry failed.')}
            </div>
          )}
        </section>
      )}

      {/* Eligible but not yet submitted for payment */}
      <section className="rounded-card border border-warning/25 bg-warning/10 overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          <Clock className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-amber-900">Not yet submitted for payment</h2>
            <p className="mt-0.5 text-sm text-warning">
              These users attended their session and completed the post-event survey, but have not submitted a payment request. Follow up or open their program hub to initiate.
            </p>
          </div>
        </div>
        {filteredEligible.length === 0 ? (
          <p className="px-6 py-8 text-sm text-amber-900">
            {eligibleNotSubmitted.length === 0
              ? 'No eligible rows awaiting a payment request.'
              : 'No eligible rows for this program.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-amber-200 text-sm">
              <thead className="bg-amber-100/60">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warning uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warning uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warning uppercase">Honorarium</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warning uppercase">Survey completed</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-warning uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {filteredEligible.map((r) => {
                  const programId = r.program?.id;
                  const honorarium = safeAmountCents(r.program?.honorariumAmount);
                  return (
                  <tr key={r.id} className="bg-white/70 hover:bg-white">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {r.user?.firstName ?? ''} {r.user?.lastName ?? ''}
                      </p>
                      <p className="text-xs text-gray-500">{r.user?.email ?? '—'}</p>
                      {r.user?.specialty ? (
                        <p className="text-xs text-gray-400">{r.user.specialty}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.program?.title ?? 'No program'}</p>
                      {r.program?.chmProgramId ? (
                        <p className="mt-0.5 font-mono text-[11px] text-gray-500">{r.program.chmProgramId}</p>
                      ) : null}
                      {r.program?.sponsorName ? (
                        <p className="text-xs text-gray-500">{r.program.sponsorName}</p>
                      ) : null}
                      <p className="text-xs text-gray-500">
                        {r.program?.zoomSessionType === 'MEETING' ? 'Office Hours' : 'Live webinar'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {honorarium > 0 ? formatMoney(honorarium) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.postEventSurveyAcknowledgedAt
                        ? format(new Date(r.postEventSurveyAcknowledgedAt), 'MMM d, yyyy')
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {programId ? (
                        <Link
                          to={`/admin/programs/${programId}/hub`}
                          className="text-xs font-semibold text-amber-900 underline hover:text-warning"
                        >
                          Open program hub
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      </>
      ) : null}

      {deleteConfirmPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-card bg-card p-6 shadow-card-hover space-y-4">
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
                    'Attendance, survey, Stripe payout account, or tax details are not complete yet.',
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
            <p className="text-xs text-success">Selected: {selectedUser.email}</p>
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
            className="w-full max-w-md rounded-card bg-card p-6 shadow-card-hover space-y-4"
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
                  payment, but Pay now will fail until attendance, survey, Stripe payout account, and tax
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
      ? 'border-destructive/25 bg-destructive/10'
      : variant === 'success'
        ? 'border-success/25 bg-success/10/80'
        : 'border-gray-200 bg-white';
  const labelCls =
    variant === 'danger' ? 'text-destructive' : variant === 'success' ? 'text-success' : 'text-gray-600';
  const valueCls =
    variant === 'danger' ? 'text-red-900' : variant === 'success' ? 'text-green-950' : 'text-gray-900';
  const subCls =
    variant === 'danger' ? 'text-destructive' : variant === 'success' ? 'text-success' : 'text-gray-600';

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
  const canRetry =
    !!payment.user.stripeAccountId || !!payment.user.billVendorId;

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
      <td className="px-4 py-3 text-xs text-destructive max-w-xs">
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
            No <StripeMark size="xs" /> payout account
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
      <td className="px-4 py-3 text-gray-600">
        <PaymentCampaignCell program={payment.program} />
      </td>
      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{paidLabel}</td>
    </tr>
  );
}

function PaymentCampaignCell({
  program,
}: {
  program: PendingPayment['program'];
}) {
  if (!program) return <span className="text-muted-foreground">-</span>;
  const label = program.sponsorName?.trim() || null;
  const id = program.chmProgramId?.trim() || null;
  if (!label && !id) return <span className="text-muted-foreground">-</span>;
  return (
    <div>
      {label ? <p className="text-sm text-foreground">{label}</p> : null}
      {id ? (
        <p className="font-mono text-[11px] text-muted-foreground" title="Internal CHM Content ID">
          {id}
        </p>
      ) : null}
    </div>
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
  const hasStripe =
    !!payment.user.stripeAccountId && payment.user.stripePayoutsEnabled !== false;
  const hasPayoutAccount = hasStripe || !!payment.user.billVendorId;
  const hasW9 = payment.user.w9Submitted !== false;
  const canPay = hasPayoutAccount && hasW9;
  const blockReason = !hasPayoutAccount
    ? 'No Stripe payout account: HCP must complete ACH Connect onboarding'
    : !hasW9
      ? 'Tax details incomplete: HCP must finish Stripe onboarding tax info'
      : null;

  const methodLabel =
    payment.user.preferredPaymentMethod === 'CHECK'
      ? 'Check (legacy)'
      : `ACH${payment.user.bankAccountLast4 ? ` · ••••${payment.user.bankAccountLast4}` : ''}`;

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
      <td className="px-4 py-3 text-sm text-muted-foreground">
        <PaymentCampaignCell program={payment.program} />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{format(new Date(payment.createdAt), 'MMM d, yyyy')}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onPayNow}
            disabled={!canPay || isPaying}
            title={blockReason ?? 'Send payout via Stripe ACH'}
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
