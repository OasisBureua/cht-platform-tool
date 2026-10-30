import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  Columns2,
  GitCompare,
  Loader2,
  Search,
} from 'lucide-react';

import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import {
  SurveyEmptyState,
  SurveyStatusPill,
  SurveyWorkspaceHero,
} from '../../components/admin/survey-workspace';
import { adminSurveyDisplayTitle } from '../../utils/admin-survey-display';
import { getApiErrorMessage } from '../../api/client';

const MAX_COMPARE = 3;
const PICKER_LIMIT = 50;

type CompareCandidate = {
  id: string;
  title: string;
  type: string;
  isCustomized: boolean;
  responseCount: number;
  program: { id: string; title: string } | null;
};

function parseIds(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_COMPARE);
}

function formatRate(
  completion: { rate: number; completed: number; eligible: number } | null,
): string {
  if (!completion || completion.eligible <= 0) return '—';
  return `${Math.round(completion.rate)}%`;
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    access: 'Access',
    registration: 'Registration',
    livestream: 'Livestream',
    honorarium: 'Honorarium',
  };
  return labels[stage] ?? stage.charAt(0).toUpperCase() + stage.slice(1);
}

export default function AdminSurveyCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerQuery, setPickerQuery] = useState(
    () => searchParams.get('q')?.trim() ?? '',
  );
  const [debouncedQuery, setDebouncedQuery] = useState(
    () => searchParams.get('q')?.trim() ?? '',
  );
  const selectedIds = useMemo(
    () => parseIds(searchParams.get('ids')),
    [searchParams],
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(pickerQuery.trim()), 300);
    return () => window.clearTimeout(t);
  }, [pickerQuery]);

  const setSelectedIds = useCallback(
    (ids: string[]) => {
      const next = new URLSearchParams(searchParams);
      const clean = [...new Set(ids)].slice(0, MAX_COMPARE);
      if (clean.length === 0) next.delete('ids');
      else next.set('ids', clean.join(','));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setPickerQueryAndUrl = useCallback(
    (value: string) => {
      setPickerQuery(value);
      const next = new URLSearchParams(searchParams);
      const trimmed = value.trim();
      if (trimmed) next.set('q', trimmed);
      else next.delete('q');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const {
    data: candidates,
    isLoading: listLoading,
    isFetching: listFetching,
  } = useQuery({
    queryKey: [
      'admin',
      'surveys',
      'compare-candidates',
      debouncedQuery,
      selectedIds.join(','),
    ],
    queryFn: () =>
      adminApi.listSurveyCompareCandidates({
        q: debouncedQuery || undefined,
        limit: PICKER_LIMIT,
        includeIds: selectedIds,
      }),
    placeholderData: keepPreviousData,
  });

  const visibleSurveys = candidates?.items ?? [];
  const totalMatching = candidates?.totalMatching ?? 0;

  // Drop URL ids that are not FEEDBACK candidates (e.g. deep-link from INTAKE).
  useEffect(() => {
    if (!candidates) return;
    const allowed = new Set(candidates.items.map((s) => s.id));
    const pruned = selectedIds.filter((id) => allowed.has(id));
    if (pruned.length === selectedIds.length) return;
    setSelectedIds(pruned);
  }, [candidates, selectedIds, setSelectedIds]);

  const canCompare = selectedIds.length >= 2 && selectedIds.length <= MAX_COMPARE;

  const {
    data: compare,
    isLoading: compareLoading,
    isError: compareError,
    error: compareErr,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['admin', 'surveys', 'compare', selectedIds.join(',')],
    queryFn: () => adminApi.compareSurveys(selectedIds),
    enabled: canCompare,
  });

  const toggleSurvey = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= MAX_COMPARE) return;
    setSelectedIds([...selectedIds, id]);
  };

  const allEaseStages = useMemo(() => {
    if (!compare) return [] as string[];
    const set = new Set<string>();
    for (const col of compare.columns) {
      for (const row of col.easeByStage) set.add(row.stage);
    }
    return [...set];
  }, [compare]);

  return (
    <div className="space-y-6 pb-16" data-testid="survey-compare-page">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link
          to="/admin/surveys"
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Surveys
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-foreground">Compare</span>
      </div>

      <SurveyWorkspaceHero
        title="Compare webinars"
        description="Pick 2–3 post-event (FEEDBACK) surveys — ideally the same HCP Beta template — and read completion, ease, and NPS side by side."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCompare || isFetching}
            onClick={() => void refetch()}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <GitCompare className="h-4 w-4" aria-hidden />
            )}
            Refresh
          </Button>
        }
      />

      <section className="rounded-card border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Select surveys ({selectedIds.length}/{MAX_COMPARE})
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              FEEDBACK only. Same template preferred for shared-question rows.
            </p>
          </div>
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Clear selection
            </button>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <label className="relative block max-w-xl">
            <span className="sr-only">Search post-event surveys</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={pickerQuery}
              onChange={(e) => setPickerQueryAndUrl(e.target.value)}
              placeholder="Search by webinar or survey name…"
              className="h-10 w-full rounded-[6px] border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
            />
          </label>

          {listLoading && !candidates ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner />
            </div>
          ) : !debouncedQuery && totalMatching === 0 ? (
            <SurveyEmptyState
              className="border-dashed shadow-none"
              title="No post-event surveys yet"
              description="Create or ensure native FEEDBACK surveys on programs, then return here to compare."
              action={
                <Link
                  to="/admin/surveys"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Back to surveys
                </Link>
              }
            />
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Showing {visibleSurveys.length}
                {totalMatching > visibleSurveys.length
                  ? ` of ${totalMatching.toLocaleString()}`
                  : ''}{' '}
                post-event surveys
                {debouncedQuery ? ` matching “${debouncedQuery}”` : ''}
                {listFetching ? ' · searching…' : ''}. Scroll for more
                {totalMatching > PICKER_LIMIT
                  ? ` (narrow search — first ${PICKER_LIMIT} shown)`
                  : ''}
                .
              </p>
              {visibleSurveys.length === 0 ? (
                <SurveyEmptyState
                  className="border-dashed shadow-none"
                  title="No surveys match that search"
                  description="Try another webinar name, or clear the search to see the full list."
                  action={
                    <button
                      type="button"
                      onClick={() => setPickerQueryAndUrl('')}
                      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      Clear search
                    </button>
                  }
                />
              ) : (
                <ul
                  className="grid max-h-[13.5rem] gap-2 overflow-y-auto overscroll-y-contain pe-1 sm:grid-cols-2 sm:max-h-[14.5rem] lg:grid-cols-3 lg:max-h-[8.5rem]"
                  data-testid="survey-compare-picker-list"
                >
                  {visibleSurveys.map((s) => (
                    <ComparePickerRow
                      key={s.id}
                      survey={s}
                      selected={selectedIds.includes(s.id)}
                      disabled={
                        !selectedIds.includes(s.id) &&
                        selectedIds.length >= MAX_COMPARE
                      }
                      onToggle={() => toggleSurvey(s.id)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {!canCompare ? (
        <SurveyEmptyState
          icon={<Columns2 className="h-5 w-5" aria-hidden />}
          title="Select at least two surveys"
          description="Choose 2 or 3 post-event surveys above to build the comparison table."
        />
      ) : compareLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <LoadingSpinner />
          <p className="text-sm text-muted-foreground">Building comparison…</p>
        </div>
      ) : compareError || !compare ? (
        <SurveyEmptyState
          icon={<AlertTriangle className="h-5 w-5" aria-hidden />}
          title="Could not compare these surveys"
          description={getApiErrorMessage(
            compareErr,
            'Could not load comparison. Confirm both surveys are FEEDBACK and the API is reachable, then retry.',
          )}
          action={
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Retry
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {compare.warnings.length > 0 ? (
            <div className="space-y-2 rounded-card border border-amber-200/80 bg-amber-50/80 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-50">
              {compare.warnings.map((w) => (
                <p key={w} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto overscroll-x-contain rounded-card border border-border bg-card shadow-card [-webkit-overflow-scrolling:touch]">
            <table className="min-w-[40rem] w-full text-sm md:min-w-full" data-testid="survey-compare-table">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="sticky left-0 z-10 bg-muted/95 px-4 py-3 font-semibold text-foreground backdrop-blur">
                    Metric
                  </th>
                  {compare.columns.map((col) => (
                    <th
                      key={col.surveyId}
                      className="min-w-[11rem] px-4 py-3 font-semibold text-foreground"
                    >
                      <div className="space-y-1">
                        <Link
                          to={`/admin/surveys/${col.surveyId}?tab=results`}
                          className="hover:underline"
                        >
                          {col.program?.title ?? col.title}
                        </Link>
                        <div className="flex flex-wrap gap-1">
                          {col.hasBetaInsights ? (
                            <SurveyStatusPill kind="ready">Beta insights</SurveyStatusPill>
                          ) : (
                            <SurveyStatusPill kind="draft">No beta meta</SurveyStatusPill>
                          )}
                          {!col.hasNativeSchema ? (
                            <SurveyStatusPill kind="jotform">Jotform</SurveyStatusPill>
                          ) : null}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <CompareRow label="Responses">
                  {compare.columns.map((col) => (
                    <td key={col.surveyId} className="px-4 py-3 tabular-nums font-semibold">
                      {col.responseCount.toLocaleString()}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Completion">
                  {compare.columns.map((col) => (
                    <td key={col.surveyId} className="px-4 py-3">
                      <span className="font-semibold tabular-nums">
                        {formatRate(col.completionRate)}
                      </span>
                      {col.completionRate ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {col.completionRate.completed}/{col.completionRate.eligible}{' '}
                          eligible
                        </span>
                      ) : null}
                    </td>
                  ))}
                </CompareRow>
                <CompareRow label="Avg ease (1–5)">
                  {compare.columns.map((col) => (
                    <td key={col.surveyId} className="px-4 py-3 tabular-nums font-semibold">
                      {col.averageEase != null ? col.averageEase.toFixed(2) : '—'}
                    </td>
                  ))}
                </CompareRow>
                {allEaseStages.map((stage) => (
                  <CompareRow key={stage} label={`${stageLabel(stage)} ease`}>
                    {compare.columns.map((col) => {
                      const row = col.easeByStage.find((e) => e.stage === stage);
                      return (
                        <td key={col.surveyId} className="px-4 py-3 tabular-nums">
                          {row?.average != null ? (
                            <>
                              <span className="font-semibold">{row.average.toFixed(2)}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {row.count} rated
                              </span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      );
                    })}
                  </CompareRow>
                ))}
                <CompareRow label="NPS">
                  {compare.columns.map((col) => (
                    <td key={col.surveyId} className="px-4 py-3">
                      {col.nps ? (
                        <>
                          <span className="font-semibold tabular-nums">
                            {col.nps.score != null ? col.nps.score : '—'}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {col.nps.promoters}P · {col.nps.passives}Pass ·{' '}
                            {col.nps.detractors}D
                          </span>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                  ))}
                </CompareRow>
                {compare.sharedQuestions.map((q) => (
                  <CompareRow
                    key={q.prompt}
                    label={q.prompt}
                    hint={q.kind === 'rating' ? 'Mean rating' : 'Top choice'}
                  >
                    {q.values.map((v) => (
                      <td key={v.surveyId} className="px-4 py-3">
                        {q.kind === 'rating' ? (
                          <>
                            <span className="font-semibold tabular-nums">
                              {v.mean != null ? v.mean.toFixed(1) : '—'}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {v.count} answered
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-foreground">
                              {v.topOption ?? '—'}
                            </span>
                            {v.topPercentage != null ? (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {v.topPercentage.toFixed(0)}% · {v.count} answered
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    ))}
                  </CompareRow>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparePickerRow({
  survey,
  selected,
  disabled,
  onToggle,
}: {
  survey: CompareCandidate;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const label = adminSurveyDisplayTitle(
    survey.program?.title,
    survey.type,
    survey.title,
  );
  return (
    <li>
      <label
        className={[
          'flex cursor-pointer items-start gap-3 rounded-[6px] border px-3 py-2.5 transition-colors',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
          selected
            ? 'border-brand-300 bg-brand-50/70 dark:border-brand-800 dark:bg-brand-950/30'
            : 'border-border hover:bg-muted/40',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      >
        <input
          type="checkbox"
          className="mt-1"
          checked={selected}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {(survey.responseCount ?? 0).toLocaleString()} responses
            {survey.isCustomized ? ' · customized' : ''}
          </span>
        </span>
      </label>
    </li>
  );
}

function CompareRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <tr className="align-top">
      <th className="sticky left-0 z-10 max-w-[14rem] bg-card px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
        <span className="normal-case text-sm font-semibold text-foreground">{label}</span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] font-medium normal-case tracking-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </th>
      {children}
    </tr>
  );
}
