import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  Filter,
  MousePointerClick,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  adminApi,
  type CampaignsFunnelQuery,
  type FunnelStageKey,
  type FunnelStageSummary,
} from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

const HUBSPOT_SCOPES_DOC =
  'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/scopes';

const selectClassName =
  'mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-card disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground';

const inputClassName =
  'mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-card';

type DatePreset = '30' | '90' | 'custom';

type FilterDraft = {
  datePreset: DatePreset;
  startDate: string;
  endDate: string;
  campaignId: string;
  clientSponsor: string;
  programId: string;
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function defaultDraft(): FilterDraft {
  return {
    datePreset: '90',
    startDate: isoDaysAgo(90),
    endDate: isoToday(),
    campaignId: '',
    clientSponsor: '',
    programId: '',
  };
}

function draftFromSearchParams(params: URLSearchParams): FilterDraft {
  const base = defaultDraft();
  const campaignId = params.get('campaign')?.trim() || '';
  const clientSponsor = params.get('client')?.trim() || '';
  const programId = params.get('program')?.trim() || '';
  const startDate = params.get('startDate')?.trim() || '';
  const endDate = params.get('endDate')?.trim() || '';
  const hasCustomDates = Boolean(startDate && endDate);
  return {
    ...base,
    campaignId,
    clientSponsor,
    programId,
    ...(hasCustomDates
      ? { datePreset: 'custom' as const, startDate, endDate }
      : {}),
  };
}

function draftToQuery(draft: FilterDraft): CampaignsFunnelQuery {
  let startDate = draft.startDate;
  let endDate = draft.endDate;
  if (draft.datePreset === '30') {
    startDate = isoDaysAgo(30);
    endDate = isoToday();
  } else if (draft.datePreset === '90') {
    startDate = isoDaysAgo(90);
    endDate = isoToday();
  }
  return {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    campaignId: draft.campaignId || undefined,
    clientSponsor: draft.clientSponsor || undefined,
    programId: draft.programId || undefined,
  };
}

function queriesEqual(a: CampaignsFunnelQuery, b: CampaignsFunnelQuery): boolean {
  return (
    (a.startDate ?? '') === (b.startDate ?? '') &&
    (a.endDate ?? '') === (b.endDate ?? '') &&
    (a.campaignId ?? '') === (b.campaignId ?? '') &&
    (a.clientSponsor ?? '') === (b.clientSponsor ?? '') &&
    (a.programId ?? '') === (b.programId ?? '')
  );
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

function formatDropOff(pct: number | null): string {
  if (pct == null) return '—';
  // Defensive: drop-off is never negative (API clamps growth to 0%)
  return `${Math.max(0, pct)}%`;
}

function formatActivityAt(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function activityTypeLabel(type: 'register' | 'attend' | 'survey'): string {
  if (type === 'register') return 'Registered';
  if (type === 'attend') return 'Attended';
  return 'Survey';
}

/**
 * Campaigns Dashboard → Funnel tab (Chunks 3–7).
 */
export default function AdminCampaignsFunnel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState<FilterDraft>(() =>
    draftFromSearchParams(searchParams),
  );
  const [applied, setApplied] = useState<CampaignsFunnelQuery>(() =>
    draftToQuery(draftFromSearchParams(searchParams)),
  );
  const [selectedStageKey, setSelectedStageKey] =
    useState<FunnelStageKey | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const peoplePanelRef = useRef<HTMLElement | null>(null);
  const urlHydrated = useRef(false);

  useEffect(() => {
    if (urlHydrated.current) return;
    urlHydrated.current = true;
    const fromUrl = draftFromSearchParams(searchParams);
    setDraft(fromUrl);
    setApplied(draftToQuery(fromUrl));
  }, [searchParams]);

  const filtersDirty = !queriesEqual(draftToQuery(draft), applied);

  const selectStage = (key: FunnelStageKey) => {
    setSelectedStageKey(key);
    setSelectedUserId(null);
    // People panel sits below the stage cards — scroll so the result is visible.
    requestAnimationFrame(() => {
      peoplePanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'campaigns-funnel', applied],
    queryFn: () => adminApi.getCampaignsFunnel(applied),
    staleTime: 60_000,
  });

  const stages: FunnelStageSummary[] = data?.stages ?? [];
  const selectedStage =
    stages.find((s) => s.key === selectedStageKey) ?? null;
  const clientRollup = data?.clientRollup ?? [];
  const allStagesZero =
    stages.length > 0 && stages.every((s) => s.count === 0);

  const {
    data: peopleData,
    isLoading: peopleLoading,
    isError: peopleError,
    error: peopleErrorObj,
  } = useQuery({
    queryKey: ['admin', 'campaigns-funnel-people', selectedStageKey, applied],
    queryFn: () =>
      adminApi.getCampaignsFunnelPeople({
        ...applied,
        stage: selectedStageKey!,
        limit: 50,
        offset: 0,
      }),
    enabled: Boolean(selectedStageKey),
    staleTime: 30_000,
  });

  const {
    data: hcpData,
    isLoading: hcpLoading,
    isError: hcpError,
    error: hcpErrorObj,
  } = useQuery({
    queryKey: ['admin', 'campaigns-funnel-hcp', selectedUserId],
    queryFn: () => adminApi.getCampaignsFunnelHcp(selectedUserId!),
    enabled: Boolean(selectedUserId),
    staleTime: 30_000,
  });

  const periodLabel = useMemo(() => {
    if (!data?.reportingPeriodStart || !data?.reportingPeriodEnd) return null;
    return `${data.reportingPeriodStart} → ${data.reportingPeriodEnd}`;
  }, [data?.reportingPeriodStart, data?.reportingPeriodEnd]);

  const syncUrlFromDraft = (next: FilterDraft) => {
    const params = new URLSearchParams();
    if (next.campaignId) params.set('campaign', next.campaignId);
    if (next.clientSponsor) params.set('client', next.clientSponsor);
    if (next.programId) params.set('program', next.programId);
    if (next.datePreset === 'custom') {
      if (next.startDate) params.set('startDate', next.startDate);
      if (next.endDate) params.set('endDate', next.endDate);
    }
    setSearchParams(params, { replace: true });
  };

  const clearPeopleSelection = () => {
    setSelectedStageKey(null);
    setSelectedUserId(null);
  };

  const applyFilters = (override?: FilterDraft) => {
    const next = override ?? draft;
    if (override) setDraft(override);
    setApplied(draftToQuery(next));
    clearPeopleSelection();
    syncUrlFromDraft(next);
  };

  const resetFilters = () => {
    const next = defaultDraft();
    setDraft(next);
    setApplied(draftToQuery(next));
    clearPeopleSelection();
    setSearchParams({}, { replace: true });
  };

  const hcpName = hcpData
    ? [hcpData.firstName, hcpData.lastName].filter(Boolean).join(' ').trim() ||
      '—'
    : null;

  const hubspotDisconnected = data != null && !data.hubspot.connected;
  const hubspotScopesMissing =
    data != null &&
    data.hubspot.connected &&
    !data.hubspot.marketingScopesGranted;
  const contentHubUnavailable =
    data != null &&
    (!data.contentHub.configured || !data.contentHub.reachable);

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {periodLabel ? (
            <span>
              Reporting period{' '}
              <span className="font-medium text-muted-foreground">
                {periodLabel}
              </span>
            </span>
          ) : null}
          {data?.syncedAt ? (
            <span className="ml-2">
              · Synced {new Date(data.syncedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw
            className={['h-4 w-4', isFetching ? 'animate-spin' : ''].join(' ')}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {/* 1. Overview */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Funnel overview
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              See how people move from HubSpot awareness into CHT registration,
              attendance, and survey completion — and where they drop off.
            </p>
          </div>
        </div>
        <p className="rounded-lg border border-border bg-gray-50/80 px-3 py-2 text-xs text-muted-foreground dark:bg-zinc-800/50">
          <span className="font-semibold text-foreground">
            Converted
          </span>{' '}
          means attended and completed the post-event survey — not a HubSpot
          deal. Drop-off across HubSpot → CHT is directional (different systems),
          not a single nested people cohort.
        </p>
      </section>

      {hubspotDisconnected ? (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 dark:border-amber-900/50 dark:bg-amber-950/25">
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
              aria-hidden
            />
            <div className="text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">HubSpot is not connected</p>
              <p className="mt-1">
                Aware / Engaged / Captured will stay at zero until{' '}
                <code className="font-mono text-xs">HUBSPOT_ACCESS_TOKEN</code>{' '}
                is configured. Registered / Attended / Converted still load from
                CHT.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {hubspotScopesMissing ? (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 dark:border-amber-900/50 dark:bg-amber-950/25">
          <div className="flex gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-warning"
              aria-hidden
            />
            <div className="space-y-2 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">
                HubSpot marketing scopes are missing
              </p>
              <p>
                Live Aware / Engaged / Captured metrics need campaign scopes
                {(data.hubspot.missingScopes ?? []).length
                  ? `: ${(data.hubspot.missingScopes ?? []).join(', ')}`
                  : ' (marketing.campaigns.read and related).'}
              </p>
              <a
                href={HUBSPOT_SCOPES_DOC}
                target="_blank"
                rel="noreferrer"
                className="inline-flex font-medium underline underline-offset-2"
              >
                HubSpot scopes documentation
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {contentHubUnavailable ? (
        <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          Content Hub is{' '}
          {!data!.contentHub.configured ? 'not configured' : 'unreachable'}.
          The funnel still works with HubSpot + CHT; client filter/rollup will be
          limited until Content Hub campaigns are linked.
        </div>
      ) : null}

      {/* Filters */}
      <section
        className="rounded-card border border-border bg-card p-4 shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)] sm:p-5"
        aria-label="Funnel filters"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Filter
              className="h-4 w-4 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-foreground">
              Report filters
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {filtersDirty
              ? 'Filters changed — click Apply to refresh'
              : 'Apply to refresh funnel counts'}
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Date range
            <select
              className={selectClassName}
              value={draft.datePreset}
              onChange={(e) => {
                const datePreset = e.target.value as DatePreset;
                setDraft((prev) => ({
                  ...prev,
                  datePreset,
                  ...(datePreset === '30'
                    ? { startDate: isoDaysAgo(30), endDate: isoToday() }
                    : datePreset === '90'
                      ? { startDate: isoDaysAgo(90), endDate: isoToday() }
                      : {}),
                }));
              }}
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom range…</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Campaign
            <select
              className={selectClassName}
              value={draft.campaignId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, campaignId: e.target.value }))
              }
            >
              <option value="">All campaigns</option>
              {(data?.filters.campaigns ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client
            <select
              className={selectClassName}
              value={draft.clientSponsor}
              disabled={(data?.filters.clients.length ?? 0) === 0}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  clientSponsor: e.target.value,
                }))
              }
            >
              <option value="">All clients</option>
              {(data?.filters.clients ?? []).map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Program
            <select
              className={selectClassName}
              value={draft.programId}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, programId: e.target.value }))
              }
            >
              <option value="">All programs</option>
              {(data?.filters.programs ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {draft.datePreset === 'custom' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Start date
              <input
                type="date"
                className={inputClassName}
                value={draft.startDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </label>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              End date
              <input
                type="date"
                className={inputClassName}
                value={draft.endDate}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyFilters()}
            className={[
              'inline-flex items-center rounded-lg px-3 py-2 text-sm font-semibold text-white dark:text-zinc-900',
              filtersDirty
                ? 'bg-blue-700 dark:bg-blue-300'
                : 'bg-gray-900 dark:bg-zinc-100',
            ].join(' ')}
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            Reset
          </button>
          {(data?.filters.clients.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">
              Client list is empty until Content Hub campaigns have a sponsor.
              Program filter still works for CHT stages.
            </p>
          ) : null}
        </div>
      </section>

      {isLoading ? <LoadingSpinner /> : null}

      {isError ? (
        <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-medium">
            {(error as Error)?.message ?? 'Failed to load funnel.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-card px-3 py-1.5 text-xs font-semibold text-destructive dark:border-red-800 dark:bg-red-950/40 dark:text-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        </div>
      ) : null}

      {data?.warnings?.length ? (
        <div className="space-y-2">
          {data.warnings.map((warning) => (
            <div
              key={warning}
              className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {/* 2. Stages */}
      <section className="space-y-3" aria-label="Funnel stages">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Funnel stages
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Progression left to right. Drop-off % is versus the previous stage.
            Click View people on Registered, Attended, or Converted to see the
            list.
          </p>
        </div>

        {data ? (
          <div className="overflow-x-auto pb-1">
            <ol className="flex min-w-[64rem] items-stretch gap-0 xl:min-w-0 xl:w-full">
              {stages.map((stage, index) => {
                const cardClassName = [
                  'flex w-full min-w-[9.5rem] flex-col rounded-card border bg-card p-4 text-left shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)]',
                  stage.peopleAvailable
                    ? 'group cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40'
                    : '',
                  stage.peopleAvailable && selectedStageKey === stage.key
                    ? 'border-brand-400 ring-2 ring-brand-500/30 dark:border-brand-600'
                    : 'border-border',
                  stage.peopleAvailable
                    ? 'hover:border-brand-300 hover:ring-2 hover:ring-brand-500/30 dark:hover:border-brand-700'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const cardBody = (
                  <>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Stage {index + 1}
                    </span>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {stage.label}
                    </p>
                    <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">
                      {formatCount(stage.count)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {index === 0
                        ? 'Baseline stage'
                        : `Drop-off from prior ${formatDropOff(stage.dropOffFromPreviousPct)}`}
                    </p>
                    <p className="mt-3 flex-1 text-[11px] leading-snug text-muted-foreground">
                      {stage.source}
                    </p>
                    {stage.peopleAvailable ? (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:underline dark:text-brand-400">
                        View people
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    ) : null}
                  </>
                );

                return (
                  <li key={stage.key} className="flex min-w-0 flex-1 items-stretch">
                    {stage.peopleAvailable ? (
                      <button
                        type="button"
                        onClick={() => selectStage(stage.key)}
                        aria-pressed={selectedStageKey === stage.key}
                        className={cardClassName}
                        aria-label={`${stage.label}: view ${formatCount(stage.count)} people`}
                      >
                        {cardBody}
                      </button>
                    ) : (
                      <div className={cardClassName} aria-label={`${stage.label}: ${formatCount(stage.count)}`}>
                        {cardBody}
                      </div>
                    )}

                    {index < stages.length - 1 ? (
                      <div
                        className="flex w-10 shrink-0 flex-col items-center justify-center px-0.5 sm:w-12"
                        aria-hidden
                      >
                        <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          {formatDropOff(
                            stages[index + 1]?.dropOffFromPreviousPct ?? null,
                          )}
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 text-gray-300 dark:text-zinc-600" />
                        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                          Drop
                        </span>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}

        {data && allStagesZero ? (
          <p className="rounded-xl border border-dashed border-border bg-gray-50/80 px-4 py-3 text-sm text-muted-foreground dark:bg-zinc-900/40">
            All stage counts are zero for this date range and filters. Try a wider
            date range, clear filters, or confirm HubSpot / CHT data exists for
            this environment.
          </p>
        ) : null}
      </section>

      {/* 3. People + HCP — immediately under stages so View people is obvious */}
      <section
        ref={peoplePanelRef}
        className="grid scroll-mt-24 gap-4 lg:grid-cols-2"
        aria-label="People and HCP drill-down"
      >
        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-start gap-2">
            <Users
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Stage → people
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Click View people on Registered, Attended, or Converted, then
                select a person for HCP drill-down.
              </p>
            </div>
          </div>

          {!selectedStageKey ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gray-50/80 px-4 py-10 text-center dark:bg-zinc-900/40">
              <MousePointerClick
                className="h-8 w-8 text-gray-300 dark:text-zinc-600"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No stage selected
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Use View people on Registered, Attended, or Converted.
              </p>
            </div>
          ) : peopleLoading ? (
            <div className="mt-4 py-8">
              <LoadingSpinner />
            </div>
          ) : peopleError ? (
            <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {(peopleErrorObj as Error)?.message ??
                'Failed to load people for this stage.'}
            </div>
          ) : peopleData && !peopleData.peopleAvailable ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-gray-50/80 px-4 py-8 text-center dark:bg-zinc-900/40">
              <p className="text-sm font-medium text-muted-foreground">
                Select Registered, Attended, or Converted
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Aware, Engaged, and Captured are HubSpot counts only (not named
                people lists).
              </p>
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 dark:border-zinc-700">
                <p className="text-xs font-semibold text-muted-foreground">
                  {selectedStage?.label ?? selectedStageKey}
                  {peopleData != null
                    ? peopleData.total > peopleData.items.length
                      ? ` · showing ${peopleData.items.length.toLocaleString()} of ${peopleData.total.toLocaleString()}`
                      : ` · ${peopleData.total.toLocaleString()} people`
                    : ''}
                </p>
              </div>
              {(peopleData?.warnings?.length ?? 0) > 0 ? (
                <div className="space-y-1 border-b border-amber-100 bg-warning/10 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
                  {peopleData!.warnings.map((w) => (
                    <p
                      key={w}
                      className="text-xs text-amber-900 dark:text-amber-100"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              ) : null}
              {(peopleData?.items.length ?? 0) === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    No people in this stage
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No matching people for the current date range and filters
                    {selectedStage
                      ? ` (stage count is ${formatCount(selectedStage.count)})`
                      : ''}
                    .
                  </p>
                </div>
              ) : (
                <div className="max-h-80 overflow-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Name</th>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">NPI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                      {peopleData!.items.map((person) => {
                        const name =
                          [person.firstName, person.lastName]
                            .filter(Boolean)
                            .join(' ')
                            .trim() || '—';
                        const canSelect = Boolean(person.userId);
                        const isSelected =
                          canSelect && person.userId === selectedUserId;
                        return (
                          <tr
                            key={`${person.userId ?? person.email ?? 'hs'}-${person.campaignId ?? ''}-${person.programId ?? ''}-${person.npiNumber ?? ''}`}
                            className={[
                              'text-foreground',
                              canSelect
                                ? 'cursor-pointer hover:bg-muted'
                                : '',
                              isSelected
                                ? 'bg-blue-50/80 dark:bg-blue-950/30'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => {
                              if (person.userId) {
                                setSelectedUserId(person.userId);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (
                                person.userId &&
                                (e.key === 'Enter' || e.key === ' ')
                              ) {
                                e.preventDefault();
                                setSelectedUserId(person.userId);
                              }
                            }}
                            tabIndex={canSelect ? 0 : undefined}
                            aria-selected={isSelected || undefined}
                          >
                            <td className="px-3 py-2.5">
                              <div className="font-medium">{name}</div>
                              {person.programTitle ? (
                                <div className="text-xs text-muted-foreground">
                                  {person.programTitle}
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground">
                              {person.email ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                              {person.npiNumber ?? '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <div className="flex items-start gap-2">
            <Search
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <h2 className="text-base font-semibold text-foreground">
                HCP drill-down
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Match HubSpot contact to CHT user (email, then NPI). Show last
                campaign and last CHT activity (register / attend / survey).
              </p>
            </div>
          </div>
          {!selectedUserId ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-gray-50/80 px-4 py-10 text-center dark:bg-zinc-900/40">
              <Search
                className="h-8 w-8 text-gray-300 dark:text-zinc-600"
                aria-hidden
              />
              <p className="mt-3 text-sm font-medium text-muted-foreground">
                No HCP selected
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Click a person in the stage list to open their drill-down.
              </p>
            </div>
          ) : hcpLoading ? (
            <div className="mt-4 py-8">
              <LoadingSpinner />
            </div>
          ) : hcpError ? (
            <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
              {(hcpErrorObj as Error)?.message ??
                'Failed to load HCP drill-down.'}
            </div>
          ) : hcpData ? (
            <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-muted-foreground dark:bg-zinc-700">
                  {(hcpName ?? '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {hcpName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {hcpData.email ?? '—'}
                    {hcpData.npiNumber ? ` · NPI ${hcpData.npiNumber}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    HubSpot match:{' '}
                    {hcpData.match.matched
                      ? `Yes (${hcpData.match.method})`
                      : 'No'}
                  </p>
                </div>
              </div>

              {(hcpData.warnings?.length ?? 0) > 0 ? (
                <div className="space-y-1 rounded-lg border border-amber-100 bg-warning/10 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30">
                  {hcpData.warnings.map((w) => (
                    <p
                      key={w}
                      className="text-xs text-amber-900 dark:text-amber-100"
                    >
                      {w}
                    </p>
                  ))}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Last campaign
                  </p>
                  {hcpData.lastCampaign?.name ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {hcpData.lastCampaign.name}
                      </p>
                      {hcpData.lastCampaign.clientSponsor ? (
                        <p className="text-xs text-muted-foreground">
                          {hcpData.lastCampaign.clientSponsor}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      —
                    </p>
                  )}
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Latest CHT activity
                  </p>
                  {hcpData.lastChtActivity[0] ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {activityTypeLabel(hcpData.lastChtActivity[0].type)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatActivityAt(hcpData.lastChtActivity[0].at)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      —
                    </p>
                  )}
                </div>
              </div>

              {hcpData.lastChtActivity.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <p className="border-b border-gray-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:border-zinc-700">
                    Activity timeline
                  </p>
                  <ul className="max-h-48 divide-y divide-gray-100 overflow-auto dark:divide-zinc-700">
                    {hcpData.lastChtActivity.map((event, index) => (
                      <li
                        key={`${event.type}-${event.programId}-${event.at}-${index}`}
                        className="px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {activityTypeLabel(event.type)}
                            </p>
                            {event.programTitle ? (
                              <p className="truncate text-xs text-muted-foreground">
                                {event.programTitle}
                              </p>
                            ) : null}
                          </div>
                          <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {formatActivityAt(event.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* 4. Client rollup */}
      <section className="space-y-3" aria-label="Client rollup">
        <div className="flex items-start gap-2">
          <Building2
            className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Client rollup
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Group funnel activity by Content Hub sponsor when campaigns are
              linked. Unlinked HubSpot campaigns appear as Not linked. Click a
              linked row to filter the funnel by that client.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-card border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Client / sponsor → funnel → HCPs
            </p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {clientRollup.length} row{clientRollup.length === 1 ? '' : 's'}
            </span>
          </div>
          {clientRollup.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No client rollup rows for the current filters. Link HubSpot
              campaigns in Content Hub (with clientSponsor) to populate linked
              rows.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Client / sponsor</th>
                  <th className="px-4 py-2.5 font-semibold">Campaigns</th>
                  <th className="px-4 py-2.5 font-semibold">Aware</th>
                  <th className="px-4 py-2.5 font-semibold">Captured</th>
                  <th className="px-4 py-2.5 font-semibold">Registered</th>
                  <th className="px-4 py-2.5 font-semibold">Attended</th>
                  <th className="px-4 py-2.5 font-semibold">Converted</th>
                  <th className="px-4 py-2.5 font-semibold">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                {clientRollup.map((row) => {
                  const label = row.linked
                    ? row.clientSponsor?.trim() || 'Linked (no sponsor name)'
                    : 'Not linked';
                  const canFilter = row.linked && Boolean(row.clientSponsor);
                  const isActive =
                    canFilter &&
                    applied.clientSponsor?.toLowerCase() ===
                      row.clientSponsor!.toLowerCase();
                  return (
                    <tr
                      key={`${row.linked ? 'l' : 'u'}-${label}-${row.campaignCount}`}
                      className={[
                        'text-foreground',
                        canFilter
                          ? 'cursor-pointer hover:bg-muted'
                          : '',
                        isActive ? 'bg-blue-50/70 dark:bg-blue-950/20' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => {
                        if (!canFilter || !row.clientSponsor) return;
                        applyFilters({
                          ...draft,
                          clientSponsor: row.clientSponsor,
                          campaignId: '',
                        });
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{label}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {row.linked ? 'Content Hub linked' : 'HubSpot only'}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCount(row.campaignCount)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCount(row.countsByStage.aware)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCount(row.countsByStage.captured)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCount(row.countsByStage.registered)}
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        {formatCount(row.countsByStage.attended)}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium">
                        {formatCount(row.countsByStage.converted)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canFilter ? (
                          <ChevronRight
                            className="ml-auto h-4 w-4 text-muted-foreground"
                            aria-hidden
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-muted-foreground dark:border-zinc-700">
            Stage counts above remain the filtered funnel total. Rollup rows
            split that activity by sponsor when Content Hub links exist.
          </p>
        </div>
      </section>
    </div>
  );
}
