import { useMemo, useState } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  adminApi,
  type PendingPayment,
  type FailedPayment,
  type PaidPayment,
  type AdminUser,
  type ProgramPaymentSummaryItem,
  type ProgramPaymentScopeId,
  type PipelineStatus,
  PIPELINE_STATUSES,
  PIPELINE_STATUS_LABELS,
  PROGRAM_PAYMENT_SCOPE_NONE,
  pipelineRowsForStatus,
  bulkPaymentRequest,
  pipelineExceptionSummary,
  pipelineExportParams,
  pipelineTimelineItems,
  unpaidDaysLabel,
} from '../../api/admin';
import { getApiErrorMessage } from '../../api/client';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { format } from 'date-fns';
import { DollarSign, CheckCircle2, AlertCircle, Trash2, Clock, X, Loader2, RefreshCw, XCircle, Plus, Download } from 'lucide-react';
import { StripeMark } from '../../components/branding/StripeMark';

function formatMoney(cents: number) {
  const n = Number.isFinite(cents) ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

function formatPipelineInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'MMM d, yyyy h:mm a');
}

function pipelineStatusClass(status: PipelineStatus): string {
  if (status === 'paid') return 'bg-success/10 text-success';
  if (status === 'failed') return 'bg-destructive/10 text-destructive';
  if (status === 'on_hold') return 'bg-warning/10 text-warning';
  if (status === 'payment_eligible' || status === 'release_pending') {
    return 'bg-brand-50 text-brand-800';
  }
  return 'bg-muted text-foreground';
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function safeAmountCents(amount: unknown): number {
  const n = typeof amount === 'number' ? amount : Number(amount);
  return Number.isFinite(n) ? n : 0;
}

async function downloadPipelineCsv(
  filters: Parameters<typeof pipelineExportParams>[0],
) {
  const params = pipelineExportParams(filters);
  const blob = await adminApi.exportPaymentsCsv(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cht-honorarium-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
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
  } | null | undefined,
  q: string,
) {
  if (!q.trim()) return true;
  if (!p?.user) return false;
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

const NO_PROGRAM_KEY = '__none__';

/**
 * Refresh program-summary and all pending/paid/failed query variants.
 * Prefix keys match scoped drill-down caches like `['admin','paid-payments', programId]`.
 */
function invalidateAdminPaymentQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-program-summary'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'pending-payments'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'paid-payments'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'failed-payments'] });
  void queryClient.invalidateQueries({ queryKey: ['admin', 'payment-pipeline'] });
}

/** Table row: all-time payment totals from summary API + eligible counts. */
type ProgramTableRow = {
  key: string;
  programId: string | null;
  title: string;
  chmProgramId: string | null;
  sponsorName: string | null;
  pendingCount: number;
  pendingTotalCents: number;
  paidCount: number;
  paidTotalCents: number;
  failedCount: number;
  failedTotalCents: number;
  eligibleCount: number;
};

function buildProgramTableRows(
  summaryPrograms: ProgramPaymentSummaryItem[],
  eligible: EligibleNotSubmittedRow[],
): ProgramTableRow[] {
  const eligibleMeta = new Map<
    string,
    {
      count: number;
      programId: string | null;
      title: string;
      chmProgramId: string | null;
      sponsorName: string | null;
    }
  >();

  for (const r of eligible) {
    if (!r || typeof r !== 'object') continue;
    const programId = r.program?.id?.trim() || null;
    const key = programId ?? NO_PROGRAM_KEY;
    const existing = eligibleMeta.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    eligibleMeta.set(key, {
      count: 1,
      programId,
      title: r.program?.title?.trim() || (programId ? 'Untitled program' : 'No program'),
      chmProgramId: r.program?.chmProgramId ?? null,
      sponsorName: r.program?.sponsorName ?? null,
    });
  }

  const rowsByKey = new Map<string, ProgramTableRow>();

  for (const item of summaryPrograms) {
    if (!item || typeof item !== 'object') continue;
    const key = item.programId ?? NO_PROGRAM_KEY;
    const eligibleCount = eligibleMeta.get(key)?.count ?? 0;
    rowsByKey.set(key, {
      key,
      programId: item.programId ?? null,
      title: typeof item.title === 'string' && item.title.trim()
        ? item.title.trim()
        : (item.programId ? 'Untitled program' : 'No program'),
      chmProgramId: item.chmProgramId ?? null,
      sponsorName: item.sponsorName ?? null,
      pendingCount: item.pending?.count ?? 0,
      pendingTotalCents: item.pending?.totalCents ?? 0,
      paidCount: item.paid?.count ?? 0,
      paidTotalCents: item.paid?.totalCents ?? 0,
      failedCount: item.failed?.count ?? 0,
      failedTotalCents: item.failed?.totalCents ?? 0,
      eligibleCount,
    });
  }

  for (const [key, meta] of eligibleMeta) {
    if (rowsByKey.has(key)) continue;
    rowsByKey.set(key, {
      key,
      programId: meta.programId,
      title: meta.title,
      chmProgramId: meta.chmProgramId,
      sponsorName: meta.sponsorName,
      pendingCount: 0,
      pendingTotalCents: 0,
      paidCount: 0,
      paidTotalCents: 0,
      failedCount: 0,
      failedTotalCents: 0,
      eligibleCount: meta.count,
    });
  }

  return [...rowsByKey.values()].sort((a, b) => {
    if (a.programId === null) return 1;
    if (b.programId === null) return -1;
    return a.title.localeCompare(b.title);
  });
}

export default function AdminPayments() {
  const queryClient = useQueryClient();
  const [deleteConfirmPaymentId, setDeleteConfirmPaymentId] = useState<string | null>(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'release' | 'hold' | null>(null);
  const [bulkReason, setBulkReason] = useState('');
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [surveyFromDraft, setSurveyFromDraft] = useState('');
  const [surveyToDraft, setSurveyToDraft] = useState('');
  const [userFilter, setUserFilter] = useState('');
  /** Single program selection: 'all' | 'none' | programId */
  const [programFilter, setProgramFilter] = useState('all');
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [selectedPipelineKey, setSelectedPipelineKey] = useState<string | null>(null);
  const [surveyFrom, setSurveyFrom] = useState('');
  const [surveyTo, setSurveyTo] = useState('');
  const isProgramDrillDown = programFilter !== 'all';
  const draftRangeInvalid = Boolean(
    surveyFromDraft && surveyToDraft && surveyFromDraft > surveyToDraft,
  );
  const dateRangeInvalid = Boolean(surveyFrom && surveyTo && surveyFrom > surveyTo);
  const applySearchFilters = () => {
    if (surveyFromDraft && surveyToDraft && surveyFromDraft > surveyToDraft) return;
    setUserFilter(nameDraft.trim());
    setSurveyFrom(surveyFromDraft);
    setSurveyTo(surveyToDraft);
    setSelectedPipelineKey(null);
  };
  const clearSearchFilters = () => {
    setNameDraft('');
    setSurveyFromDraft('');
    setSurveyToDraft('');
    setUserFilter('');
    setSurveyFrom('');
    setSurveyTo('');
    setProgramFilter('all');
    setPipelineStatus(null);
    setSelectedPipelineKey(null);
  };
  const programScopeId: ProgramPaymentScopeId | undefined = isProgramDrillDown
    ? programFilter === 'none'
      ? PROGRAM_PAYMENT_SCOPE_NONE
      : programFilter
    : undefined;

  const {
    data: programSummaryData,
    isLoading: summaryLoading,
    isError: summaryError,
    error: summaryErrorObj,
  } = useQuery({
    queryKey: ['admin', 'payment-program-summary'],
    queryFn: () => adminApi.getProgramPaymentSummary(),
  });

  const {
    data: eligibleData,
    isError: eligibleError,
    error: eligibleErrorObj,
  } = useQuery({
    queryKey: ['admin', 'payment-eligible-not-submitted'],
    queryFn: () => adminApi.listPaymentEligibleNotYetRequested(),
  });

  const pipelineProgramId = programFilter === 'all' ? undefined : programFilter;
  const {
    data: pipelineData,
    isPending: pipelinePending,
    isError: pipelineError,
    error: pipelineErrorObj,
  } = useQuery({
    queryKey: [
      'admin',
      'payment-pipeline',
      pipelineProgramId ?? 'all',
      pipelineStatus ?? 'all',
      surveyFrom,
      surveyTo,
      userFilter.trim(),
    ],
    queryFn: () =>
      adminApi.getPaymentPipeline({
        programId: pipelineProgramId,
        status: pipelineStatus ?? undefined,
        from: surveyFrom ? `${surveyFrom}T00:00:00.000Z` : undefined,
        to: surveyTo ? `${surveyTo}T23:59:59.999Z` : undefined,
        q: userFilter,
      }),
    enabled: !dateRangeInvalid,
  });
  const pipelineRows = dateRangeInvalid
    ? []
    : pipelineRowsForStatus(pipelineData?.rows ?? [], pipelineStatus);
  const pipelineCounts = new Map(
    dateRangeInvalid
      ? []
      : (pipelineData?.counts ?? []).map((item) => [item.status, item.count]),
  );
  const overdueRows = dateRangeInvalid ? [] : (pipelineData?.overdueRows ?? []);
  const exceptionItems = dateRangeInvalid ? [] : (pipelineData?.exceptions ?? []);
  const pipelineReady = !dateRangeInvalid && !pipelineError && !pipelinePending && Boolean(pipelineData);
  const selectedPipelineRow =
    pipelineRows.find((row) => `${row.programId}:${row.userId}` === selectedPipelineKey) ??
    overdueRows.find((row) => `${row.programId}:${row.userId}` === selectedPipelineKey) ??
    null;

  // Drill-down lists: server-scoped by programId (or "none"). Not fetched on overview.
  const {
    data: pendingData,
    isPending: pendingPending,
    isError: pendingError,
    error: pendingErrorObj,
  } = useQuery({
    queryKey: ['admin', 'pending-payments', programFilter],
    queryFn: () => adminApi.getPendingPayments({ programId: programScopeId! }),
    enabled: isProgramDrillDown,
  });

  const {
    data: failedData,
    isPending: failedPending,
    isError: failedError,
    error: failedErrorObj,
  } = useQuery({
    queryKey: ['admin', 'failed-payments', programFilter],
    queryFn: () => adminApi.getFailedPayments({ programId: programScopeId! }),
    enabled: isProgramDrillDown,
  });

  const {
    data: paidData,
    isPending: paidPending,
    isError: paidError,
    error: paidErrorObj,
  } = useQuery({
    queryKey: ['admin', 'paid-payments', programFilter],
    queryFn: () => adminApi.getPaidPayments({ programId: programScopeId! }),
    enabled: isProgramDrillDown,
  });

  // Normalize null/non-array API payloads so grouping never throws.
  const pending = asArray(pendingData);
  const failed = asArray(failedData);
  const eligibleNotSubmitted = asArray(eligibleData);
  const paid = asArray(paidData);
  const summaryPrograms = asArray(programSummaryData?.programs);

  const summaryTotals = useMemo(() => {
    return summaryPrograms.reduce(
      (acc, item) => {
        if (!item || typeof item !== 'object') return acc;
        acc.pendingCount += item.pending?.count ?? 0;
        acc.pendingTotalCents += item.pending?.totalCents ?? 0;
        acc.paidCount += item.paid?.count ?? 0;
        acc.failedCount += item.failed?.count ?? 0;
        return acc;
      },
      { pendingCount: 0, pendingTotalCents: 0, paidCount: 0, failedCount: 0 },
    );
  }, [summaryPrograms]);

  // Scoped lists already match program; user filter stays client-side.
  const filteredPending = useMemo(
    () => pending.filter((p) => matchesUserQuery(p, userFilter)),
    [pending, userFilter],
  );
  const filteredPaid = useMemo(
    () => paid.filter((p) => matchesUserQuery(p, userFilter)),
    [paid, userFilter],
  );
  const filteredFailed = useMemo(
    () => failed.filter((p) => matchesUserQuery(p, userFilter)),
    [failed, userFilter],
  );
  const filteredEligible = useMemo(() => {
    const rows = eligibleNotSubmitted.filter((r) => r && typeof r === 'object');
    const byUser = !userFilter.trim()
      ? rows
      : rows.filter((r) => matchesUserQuery(r, userFilter));
    return byUser.filter((r) =>
      matchesProgramFilter({ program: r.program, programId: r.program?.id }, programFilter),
    );
  }, [eligibleNotSubmitted, userFilter, programFilter]);

  // Programs table: all-time PENDING/PAID/FAILED from summary API + eligible merge.
  const programTableRows = useMemo(
    () => buildProgramTableRows(summaryPrograms, eligibleNotSubmitted),
    [summaryPrograms, eligibleNotSubmitted],
  );

  const selectedProgramRow = useMemo(() => {
    if (programFilter === 'all') return null;
    if (programFilter === 'none') {
      return programTableRows.find((r) => r.programId === null) ?? null;
    }
    return programTableRows.find((r) => r.programId === programFilter) ?? null;
  }, [programFilter, programTableRows]);

  const visibleSelectedIds = selectedPaymentIds.filter((id) =>
    filteredPending.some((payment) => payment.id === id),
  );
  const allPendingSelected =
    filteredPending.length > 0 && visibleSelectedIds.length === filteredPending.length;

  const bulkMutation = useMutation({
    mutationFn: (body: { action: 'release' | 'hold'; paymentIds: string[]; reason?: string }) =>
      adminApi.bulkPayments(body),
    onSuccess: (data) => {
      invalidateAdminPaymentQueries(queryClient);
      const failed = (data?.results ?? []).filter((row) => !row.ok);
      if (failed.length === 0) {
        setBulkAction(null);
        setBulkReason('');
        setBulkErrors([]);
        setSelectedPaymentIds([]);
        return;
      }
      setBulkErrors(
        failed.map((row) => `${row.paymentId}: ${row.error ?? 'Payment action failed'}`),
      );
      setSelectedPaymentIds(failed.map((row) => row.paymentId));
    },
    onError: (err) => {
      setBulkErrors([getApiErrorMessage(err, 'Could not update the selected payments.')]);
    },
  });

  const payNowMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.payNow(paymentId),
    onSuccess: () => {
      invalidateAdminPaymentQueries(queryClient);
    },
    onError: () => {
      // Payout failures mark the row FAILED server-side — refresh lists + summary.
      invalidateAdminPaymentQueries(queryClient);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.retryPayment(paymentId),
    onSuccess: () => {
      invalidateAdminPaymentQueries(queryClient);
    },
    onError: () => {
      invalidateAdminPaymentQueries(queryClient);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => adminApi.deletePayment(paymentId),
    onSuccess: () => {
      invalidateAdminPaymentQueries(queryClient);
      setDeleteConfirmPaymentId(null);
    },
  });

  const drillDownSummary = [
    pendingError ? 'pending unavailable' : `${filteredPending.length} pending`,
    paidError ? 'paid unavailable' : `${filteredPaid.length} paid`,
    failedError ? 'failed unavailable' : `${filteredFailed.length} failed`,
    eligibleError ? 'eligible unavailable' : `${filteredEligible.length} eligible`,
  ].join(' · ');
  const showPaymentDetails = isProgramDrillDown;
  const drillDownListsLoading = pendingPending || failedPending || paidPending;

  if (summaryLoading) return <LoadingSpinner />;

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
            disabled={exporting || dateRangeInvalid}
            onClick={() => {
              setExporting(true);
              void downloadPipelineCsv({
                programId: pipelineProgramId,
                status: pipelineStatus,
                surveyFrom,
                surveyTo,
                q: userFilter,
              })
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

      {/* Summary cards — all-time from program-summary (lists load only on drill-down) */}
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Pending count"
          value={String(summaryTotals.pendingCount)}
          sub="Awaiting payout"
        />
        <StatCard
          label="Pending total"
          value={formatMoney(summaryTotals.pendingTotalCents)}
          sub="All-time pending payment rows"
        />
        <StatCard
          label="Paid"
          value={String(summaryTotals.paidCount)}
          sub="All-time paid payment rows"
          variant="success"
        />
        <StatCard
          label="Failed payments"
          value={String(summaryTotals.failedCount)}
          sub="Need admin retry"
          variant={summaryTotals.failedCount > 0 ? 'danger' : 'default'}
        />
        <StatCard
          label="Eligible, not submitted"
          value={eligibleError ? '—' : String(eligibleNotSubmitted.length)}
          sub={eligibleError ? 'Could not load eligible rows' : 'Survey done, no payment request yet'}
        />
      </section>

      <ManualPaymentForm />

      <section className="rounded-card border border-border bg-card p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            applySearchFilters();
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="admin-payments-user-filter" className="text-xs font-semibold text-muted-foreground">
              Name or email
            </label>
            <input
              id="admin-payments-user-filter"
              type="search"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Name or email"
              className="mt-1 h-10 w-full rounded-[6px] border border-border bg-card px-3 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="admin-payments-from" className="text-xs font-semibold text-muted-foreground">
              Survey from
            </label>
            <input
              id="admin-payments-from"
              type="date"
              value={surveyFromDraft}
              onChange={(e) => setSurveyFromDraft(e.target.value)}
              className="mt-1 h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-foreground"
            />
          </div>
          <div>
            <label htmlFor="admin-payments-to" className="text-xs font-semibold text-muted-foreground">
              Survey to
            </label>
            <input
              id="admin-payments-to"
              type="date"
              value={surveyToDraft}
              onChange={(e) => setSurveyToDraft(e.target.value)}
              className="mt-1 h-10 rounded-[6px] border border-border bg-card px-3 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={draftRangeInvalid}
            className="h-10 rounded-[6px] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Apply filter
          </button>
          {(nameDraft || surveyFromDraft || surveyToDraft || userFilter || surveyFrom || surveyTo || programFilter !== 'all' || pipelineStatus) && (
            <button
              type="button"
              onClick={clearSearchFilters}
              className="h-10 rounded-[6px] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Clear filters
            </button>
          )}
        </form>
        {draftRangeInvalid ? (
          <p className="mt-2 text-xs text-destructive">Survey from must be on or before survey to.</p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {isProgramDrillDown
            ? `Drill-down: ${drillDownSummary}`
            : `${programTableRows.length} program group${programTableRows.length === 1 ? '' : 's'} · select a row to drill down`}
          {userFilter ? ' (user filtered)' : ''}
        </p>
      </section>

      <section id="honorarium-pipeline" className="rounded-card border border-border bg-card overflow-hidden">
        <div className="px-6 pt-5 pb-3 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Honorarium pipeline</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Statuses below are buttons. Click one to list those people in the table. Click a person to open their timeline.
          </p>
          {pipelineReady && pipelineData ? (
            <div className="mt-4 space-y-3">
              <dl className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['Committed', pipelineData.totals?.committedCents ?? 0],
                    ['Released', pipelineData.totals?.releasedCents ?? 0],
                    ['Outstanding', pipelineData.totals?.outstandingCents ?? 0],
                  ] as const
                ).map(([label, cents]) => (
                  <div key={label} className="rounded-[6px] border border-border bg-muted/40 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatMoney(cents)}</dd>
                  </div>
                ))}
              </dl>
              {(pipelineData.programs ?? []).length > 0 ? (
                <ul className="divide-y divide-border rounded-[6px] border border-border">
                  {(pipelineData.programs ?? []).map((program) => (
                    <li
                      key={program.programId}
                      className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-baseline sm:justify-between"
                    >
                      <span className="font-medium text-foreground">{program.programTitle}</span>
                        <span className="tabular-nums text-muted-foreground">
                        Committed {formatMoney(program.totals?.committedCents ?? 0)} · Released{' '}
                        {formatMoney(program.totals?.releasedCents ?? 0)} · Outstanding{' '}
                        {formatMoney(program.totals?.outstandingCents ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs text-muted-foreground">
                These dollars follow the program, survey dates, and name. A status does not change them.
                Released is paid honoraria with a Stripe transfer.
              </p>
            </div>
          ) : null}
        </div>
        {pipelineReady ? (
        <div className="px-6 pt-4">
          <p className="text-sm text-foreground">
            {pipelineStatus
              ? `Showing ${PIPELINE_STATUS_LABELS[pipelineStatus].toLowerCase()} in the table below. Click that status again to show everyone.`
              : 'Click a status to show only those people in the table below.'}
          </p>
        <div className="mt-3 grid grid-cols-2 gap-2 pb-4 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_STATUSES.map((status) => {
            const selected = pipelineStatus === status;
            const count = pipelineCounts.get(status) ?? 0;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  setPipelineStatus((current) => (current === status ? null : status))
                }
                className={[
                  'flex min-h-9 items-center justify-between gap-2 rounded-[6px] border px-3 py-2 text-left text-xs font-semibold',
                  selected
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : count > 0
                      ? 'border-border bg-card text-foreground hover:bg-muted'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted',
                ].join(' ')}
              >
                <span>{PIPELINE_STATUS_LABELS[status]}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
        </div>
        ) : null}
        {pipelineReady ? (
          <div className="grid border-t border-border md:grid-cols-2 md:divide-x md:divide-border">
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">Overdue</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Past the pay window and not yet paid. This list stays when a status is selected.
            </p>
            {overdueRows.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No overdue honoraria for these filters.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {overdueRows.map((row) => {
                  const rowKey = `${row.programId}:${row.userId}`;
                  return (
                    <li key={rowKey}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPipelineKey((current) => (current === rowKey ? null : rowKey))
                        }
                        className="flex w-full items-baseline justify-between gap-3 py-2 text-left text-sm hover:bg-muted/40"
                      >
                        <span>
                          <span className="font-medium text-foreground">{row.userName || row.userEmail}</span>
                          <span className="text-muted-foreground"> · {row.programTitle}</span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-destructive">
                          {unpaidDaysLabel(row) ?? `${row.aging?.daysSinceSurvey ?? '—'} days`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-6 py-4 md:border-t-0">
            <h3 className="text-sm font-semibold text-foreground">Exceptions</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each item includes the next action. This list stays when a status is selected.
            </p>
            {exceptionItems.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payment exceptions for these filters.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {exceptionItems.map((item) => {
                  const rowKey =
                    item.userId && item.programId ? `${item.programId}:${item.userId}` : null;
                  const canOpen =
                    rowKey != null &&
                    (pipelineRows.some((row) => `${row.programId}:${row.userId}` === rowKey) ||
                      overdueRows.some((row) => `${row.programId}:${row.userId}` === rowKey));
                  return (
                    <li key={`${item.code}:${item.surveyResponseId ?? rowKey ?? item.userEmail}`}>
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() => {
                          if (!rowKey || !canOpen) return;
                          setSelectedPipelineKey((current) => (current === rowKey ? null : rowKey));
                        }}
                        className="w-full py-2 text-left text-sm disabled:cursor-default"
                      >
                        <div className="font-medium text-foreground">{pipelineExceptionSummary(item)}</div>
                        <div className="text-xs text-muted-foreground">
                          {(item.userName || item.userEmail || 'No user on this survey')}
                          {item.programTitle ? ` · ${item.programTitle}` : ''}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </div>
        ) : null}
        {!pipelineReady ? (
          dateRangeInvalid ? (
            <p className="px-6 pb-6 text-sm text-destructive">
              Survey from must be on or before survey to. Counts stay hidden until the dates are valid.
            </p>
          ) : pipelineError ? (
            <div className="flex items-start gap-2 px-6 pb-6 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="font-semibold">Could not load the honorarium pipeline</p>
                <p className="mt-0.5">
                  {getApiErrorMessage(pipelineErrorObj, 'Could not load the honorarium pipeline. Refresh the page and try again.')}
                </p>
              </div>
            </div>
          ) : (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Loading pipeline…</p>
          )
        ) : pipelineRows.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">
            {programFilter === 'none'
              ? 'Payments with no program are not part of the honorarium pipeline.'
              : pipelineStatus
                ? `No one is ${PIPELINE_STATUS_LABELS[pipelineStatus].toLowerCase()} for these filters.`
                : 'No honorarium rows for these filters.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Person</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Amount</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Days since survey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pipelineRows.map((row) => {
                  const rowKey = `${row.programId}:${row.userId}`;
                  const selected = selectedPipelineKey === rowKey;
                  return (
                  <tr
                    key={rowKey}
                    aria-selected={selected}
                    onClick={() =>
                      setSelectedPipelineKey((current) => (current === rowKey ? null : rowKey))
                    }
                    className={selected ? 'cursor-pointer bg-brand-50' : 'cursor-pointer hover:bg-muted/40'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.userName || row.userEmail}</div>
                      <div className="text-xs text-muted-foreground">{row.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-foreground">{row.programTitle}</td>
                    <td className="px-4 py-3">
                      <span className={['inline-flex rounded-[6px] px-2 py-0.5 text-xs font-semibold', pipelineStatusClass(row.status)].join(' ')}>
                        {PIPELINE_STATUS_LABELS[row.status]}
                      </span>
                      {row.holdReason ? (
                        <div className="mt-1 text-xs text-muted-foreground">{row.holdReason}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoney(row.amountCents)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums">{row.aging?.daysSinceSurvey ?? '—'}</div>
                      {unpaidDaysLabel(row) ? (
                        <div className="text-xs text-muted-foreground">{unpaidDaysLabel(row)}</div>
                      ) : null}
                      {row.status !== 'paid' && row.aging?.atRisk ? (
                        <div className="mt-1 inline-flex rounded-[6px] bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">
                          At risk
                        </div>
                      ) : null}
                      {row.status !== 'paid' && row.aging?.overdue ? (
                        <div className="mt-1 inline-flex rounded-[6px] bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          Overdue
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pipelineReady && selectedPipelineRow ? (
          <div className="border-t border-border px-6 py-4">
            <h3 className="text-sm font-semibold text-foreground">Participant timeline</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {selectedPipelineRow.userName || selectedPipelineRow.userEmail} · {selectedPipelineRow.programTitle}
            </p>
            <dl className="mt-3 grid gap-3 rounded-[6px] bg-muted/40 p-4 sm:grid-cols-2">
              {pipelineTimelineItems(selectedPipelineRow, formatPipelineInstant).map((item) => (
                <div key={item.label}>
                  <dt className="text-xs font-semibold text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-sm text-foreground break-all">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
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
              Select a program to view its Pending, Paid, Failed, and Eligible payments. Pending, Paid,
              and Failed totals are all-time.
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
        {summaryError ? (
          <div className="flex items-start gap-2 px-6 py-8 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Could not load program payment totals</p>
              <p className="mt-0.5 text-destructive/90">
                {getApiErrorMessage(summaryErrorObj, 'Request failed. Try refreshing the page.')}
              </p>
            </div>
          </div>
        ) : (
          <>
        {eligibleError ? (
          <p className="px-6 py-3 text-sm text-destructive">
            {getApiErrorMessage(eligibleErrorObj, 'Could not load eligible rows.')}
            {' '}The Eligible column is hidden until that list loads. Pending, paid, and failed totals are still from the summary.
          </p>
        ) : null}
        {programTableRows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-muted-foreground text-center">
            No payment activity by program.
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
                {programTableRows.map((row) => {
                  const selectValue = row.programId ?? 'none';
                  const selected =
                    programFilter === selectValue ||
                    (programFilter === 'none' && row.programId === null);
                  return (
                    <tr
                      key={row.key}
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
                      aria-label={`Open payments for ${row.title}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{row.title}</p>
                        {row.chmProgramId ? (
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {row.chmProgramId}
                          </p>
                        ) : null}
                        {row.sponsorName ? (
                          <p className="text-xs text-muted-foreground">{row.sponsorName}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-foreground">{row.pendingCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(row.pendingTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p className="font-semibold text-foreground">{row.paidCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(row.paidTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <p
                          className={[
                            'font-semibold',
                            row.failedCount > 0 ? 'text-destructive' : 'text-foreground',
                          ].join(' ')}
                        >
                          {row.failedCount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatMoney(row.failedTotalCents)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">
                        {eligibleError ? '—' : row.eligibleCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </>
        )}
      </section>

      {isProgramDrillDown ? (
        <div className="rounded-card border border-brand-200 bg-brand-50/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedProgramRow?.title ??
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
      {drillDownListsLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
      <>
      {/* Pending table */}
      <section id="pending-table" className="rounded-card border border-border bg-card overflow-hidden">
        {pendingError ? (
          <div className="flex items-start gap-2 px-6 py-8 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold">Could not load pending payments</p>
              <p className="mt-0.5">
                {getApiErrorMessage(pendingErrorObj, 'Could not load pending payments. Refresh the page and try again.')}
              </p>
            </div>
          </div>
        ) : (
        <>
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
        {filteredPending.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <button
              type="button"
              disabled={visibleSelectedIds.length === 0}
              onClick={() => {
                setBulkErrors([]);
                setBulkReason('');
                setBulkAction('release');
              }}
              className="h-9 rounded-[6px] bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Release selected
            </button>
            <button
              type="button"
              disabled={visibleSelectedIds.length === 0}
              onClick={() => {
                setBulkErrors([]);
                setBulkAction('hold');
              }}
              className="h-9 rounded-[6px] border border-border px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              Hold selected
            </button>
            <span className="text-xs text-muted-foreground">
              {visibleSelectedIds.length} selected
            </span>
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all pending payments"
                    checked={allPendingSelected}
                    onChange={() => {
                      setSelectedPaymentIds(
                        allPendingSelected ? [] : filteredPending.map((payment) => payment.id),
                      );
                    }}
                  />
                </th>
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
                  selected={visibleSelectedIds.includes(p.id)}
                  onSelectedChange={(checked) => {
                    setSelectedPaymentIds((current) =>
                      checked ? [...current, p.id] : current.filter((id) => id !== p.id),
                    );
                  }}
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
                : 'No pending payments match this user filter'}
            </p>
            <p className="text-sm text-muted-foreground">
              {pending.length === 0
                ? 'All payouts for this program are up to date.'
                : 'Try clearing the user filter.'}
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
        </>
        )}
      </section>

      {/* Successful payouts (program-scoped) */}
      <section className="rounded-card border border-success/25 bg-success/10/40 overflow-hidden">
        <div className="flex items-start gap-3 px-6 pt-5 pb-3 border-b border-green-100 bg-success/10/80">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-green-950">Successful payments</h2>
            <p className="mt-0.5 text-sm text-green-900">
              Completed payouts for this program through <StripeMark size="xs" className="translate-y-px" />{' '}
              (newest first).
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
              {paidError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-destructive">
                    {getApiErrorMessage(paidErrorObj, 'Could not load paid payments. Refresh the page and try again.')}
                  </td>
                </tr>
              ) : filteredPaid.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    {paid.length === 0 ? (
                      <>
                        No completed payouts for this program yet. Successful payments appear here after{' '}
                        <strong>Pay now</strong> finishes.
                      </>
                    ) : (
                      'No paid payments match this user filter.'
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
      {(failedError || filteredFailed.length > 0) && (
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
          {failedError ? (
            <p className="px-6 pb-6 text-sm text-destructive">
              {getApiErrorMessage(failedErrorObj, 'Could not load failed payments. Refresh the page and try again.')}
            </p>
          ) : (
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
          )}
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
        {eligibleError ? (
          <p className="px-6 py-8 text-sm text-destructive">
            {getApiErrorMessage(eligibleErrorObj, 'Could not load eligible rows. Refresh the page and try again.')}
          </p>
        ) : filteredEligible.length === 0 ? (
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
      )}
      </>
      ) : null}

      {bulkAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-card bg-card p-6 shadow-card-hover space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-foreground">
                  {bulkAction === 'release' ? 'Release selected payments?' : 'Hold selected payments?'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {bulkAction === 'release'
                    ? `This sends ${visibleSelectedIds.length} pending payout${visibleSelectedIds.length === 1 ? '' : 's'} through Stripe. A payment that is not pending, or is already on hold, is skipped.`
                    : `This holds ${visibleSelectedIds.length} pending payout${visibleSelectedIds.length === 1 ? '' : 's'}. Pay now stays blocked until each hold is released.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBulkAction(null);
                  setBulkErrors([]);
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {bulkAction === 'hold' ? (
              <label className="block text-sm">
                <span className="font-medium text-foreground">Hold reason</span>
                <textarea
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  maxLength={500}
                  rows={3}
                  className="mt-1 w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-foreground"
                />
              </label>
            ) : null}
            {bulkErrors.length > 0 ? (
              <ul className="space-y-1 text-xs text-destructive">
                {bulkErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setBulkAction(null);
                  setBulkErrors([]);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const body = bulkPaymentRequest({
                    action: bulkAction,
                    paymentIds: visibleSelectedIds,
                    reason: bulkReason,
                    confirmed: true,
                  });
                  if (!body) return;
                  bulkMutation.mutate(body);
                }}
                disabled={
                  bulkMutation.isPending ||
                  visibleSelectedIds.length === 0 ||
                  (bulkAction === 'hold' && bulkReason.trim().length === 0)
                }
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {bulkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                Confirm
              </button>
            </div>
          </div>
        </div>
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
      invalidateAdminPaymentQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'payment-eligible-not-submitted'],
      });
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
            Queue a pending payout for a specific user and program. After it is created, select that
            program (or <strong>No program</strong>) in the Programs table below to open Pending and use{' '}
            <strong>Pay now</strong>. Honorarium + program still requires attendance verified and survey
            ack before Pay now succeeds.
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
  const canRetry = !!payment.user.stripeAccountId;

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
  selected,
  onSelectedChange,
  onPayNow,
  onRequestDelete,
  isPaying,
  isDeleting,
  payError,
}: {
  payment: PendingPayment;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onPayNow: () => void;
  onRequestDelete: () => void;
  isPaying: boolean;
  isDeleting: boolean;
  payError?: string | null;
}) {
  const hasStripe =
    !!payment.user.stripeAccountId && payment.user.stripePayoutsEnabled !== false;
  const hasPayoutAccount = hasStripe;
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
        <input
          type="checkbox"
          aria-label={`Select ${payment.user.firstName} ${payment.user.lastName}`}
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
      </td>
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
