import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  ClipboardList,
  MessageSquareText,
  Percent,
  Smile,
  Star,
  ChevronRight,
  GitCompare,
} from 'lucide-react';
import { surveysApi, type Survey } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { adminSurveyDisplayTitle } from '../../utils/admin-survey-display';
import {
  surveyListStateFromSearchParams,
  surveyListStateToSearchParams,
  surveyListQueryIsActive,
  SURVEY_LIST_QUERY_DEFAULTS,
  type SurveyListQueryState,
  type SurveyListSortField,
} from '../../utils/survey-list-query';
import {
  SurveyWorkspaceHero,
  SurveyKpiStrip,
  SurveyKpiTile,
  SurveyFilterBar,
  SurveyFilterSelect,
  SurveyEmptyState,
  SurveyStatusPill,
  SurveyAttentionList,
  SurveyTrendSparkline,
  type SurveyAttentionItem,
} from '../../components/admin/survey-workspace';

function formatKpi(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value}${suffix}`;
}

function surveyDisplayName(s: Survey): string {
  return adminSurveyDisplayTitle(s.program?.title, s.type, s.title);
}

function sortSurveyRows(
  rows: Survey[],
  sort: SurveyListSortField,
  dir: 'asc' | 'desc',
): Survey[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (sort === 'name') {
      cmp = surveyDisplayName(a).localeCompare(surveyDisplayName(b));
    } else if (sort === 'created') {
      cmp = a.createdAt.localeCompare(b.createdAt);
    } else if (sort === 'responses') {
      cmp = (a.responseCount ?? 0) - (b.responseCount ?? 0);
    } else {
      const ac = a.completionRate;
      const bc = b.completionRate;
      if (ac == null && bc == null) cmp = 0;
      else if (ac == null) return 1;
      else if (bc == null) return -1;
      else cmp = ac - bc;
    }
    if (cmp !== 0) return cmp * mult;
    return a.id.localeCompare(b.id);
  });
}

export default function AdminSurveys() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const listQuery = useMemo(
    () => surveyListStateFromSearchParams(searchParams),
    [searchParams],
  );
  const patchListQuery = useCallback(
    (patch: Partial<SurveyListQueryState>) => {
      const next = { ...listQuery, ...patch };
      setSearchParams(surveyListStateToSearchParams(next), { replace: true });
    },
    [listQuery, setSearchParams],
  );
  const clearListQuery = useCallback(() => {
    setSearchParams(surveyListStateToSearchParams(SURVEY_LIST_QUERY_DEFAULTS), {
      replace: true,
    });
  }, [setSearchParams]);

  const [templateType, setTemplateType] = useState<'all' | 'INTAKE' | 'FEEDBACK'>('all');

  const { data: surveyList, isLoading, error } = useQuery({
    queryKey: ['admin', 'surveys'],
    queryFn: () => surveysApi.getAll(),
  });

  const { data: workspaceStats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'surveys', 'workspace-stats'],
    queryFn: () => adminApi.getSurveyWorkspaceStats(),
  });

  const {
    data: templates = [],
    isLoading: templatesLoading,
    isError: templatesError,
  } = useQuery({
    queryKey: ['admin', 'surveys', 'reusable', templateType],
    queryFn: () =>
      adminApi.listReusableSurveys(
        templateType === 'all' ? undefined : templateType,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteSurvey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'surveys'] });
    },
  });

  const items = useMemo(() => surveyList?.active ?? [], [surveyList]);

  const programOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of items) {
      if (s.program?.id && s.program.title) {
        seen.set(s.program.id, s.program.title);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const attentionItems = useMemo((): SurveyAttentionItem[] => {
    if (workspaceStats?.needsAttention?.length) {
      return workspaceStats.needsAttention.map((item) => ({
        id: item.id,
        title: item.programTitle
          ? `${item.title} · ${item.programTitle}`
          : item.title,
        reason: item.reason,
        // ≤3 clicks: dashboard → survey Results (or Overview when empty).
        href: `/admin/surveys/${item.id}?tab=${
          item.kind === 'no_responses' ? 'overview' : 'results'
        }`,
        kind: item.kind,
      }));
    }
    return items
      .filter((s) => (s.responseCount ?? 0) === 0)
      .slice(0, 5)
      .map((s) => {
        const title = adminSurveyDisplayTitle(s.program?.title, s.type, s.title);
        return {
          id: s.id,
          title,
          reason: 'No responses collected yet',
          href: `/admin/surveys/${s.id}?tab=overview`,
          kind: 'no_responses' as const,
        };
      });
  }, [items, workspaceStats]);

  const filteredItems = useMemo(() => {
    const q = listQuery.q.trim().toLowerCase();
    const filtered = items.filter((s) => {
      if (listQuery.program !== 'all' && s.program?.id !== listQuery.program) {
        return false;
      }
      if (
        listQuery.session !== 'all' &&
        s.program?.zoomSessionType !== listQuery.session
      ) {
        return false;
      }
      const responses = s.responseCount ?? 0;
      if (listQuery.status === 'no_responses' && responses > 0) return false;
      if (listQuery.status === 'collecting' && responses === 0) return false;
      const isJotform = Boolean(s.jotformFormId);
      if (listQuery.source === 'native' && isJotform) return false;
      if (listQuery.source === 'jotform' && !isJotform) return false;
      if (!q) return true;
      const title = surveyDisplayName(s).toLowerCase();
      return (
        title.includes(q) ||
        s.title.toLowerCase().includes(q) ||
        (s.program?.title ?? '').toLowerCase().includes(q)
      );
    });
    return sortSurveyRows(filtered, listQuery.sort, listQuery.dir);
  }, [items, listQuery]);

  const handleDelete = (id: string, displayTitle: string) => {
    if (!window.confirm(`Delete survey "${displayTitle}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <SurveyEmptyState
        title="Could not load surveys"
        description="Something went wrong loading the workspace. Try refreshing the page."
        action={
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Refresh
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {deleteMutation.isError && (
        <div className="flex items-center justify-between rounded-card border border-destructive/25 bg-destructive/10 p-4 text-destructive">
          <span>Failed to delete survey. Please try again.</span>
          <button
            type="button"
            onClick={() => deleteMutation.reset()}
            className="text-sm font-semibold text-destructive underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <SurveyWorkspaceHero
        title="Surveys"
        description="Glance at health, open what needs attention, then move into results and participant preview — built for the HCP beta."
        actions={
          <>
            <Link
              to="/admin/surveys/compare"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-card transition-colors hover:bg-muted"
            >
              <GitCompare className="h-4 w-4" aria-hidden />
              Compare webinars
            </Link>
            <Link
              to="/admin/create-survey"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create Survey
            </Link>
          </>
        }
      />

      <SurveyKpiStrip>
        <SurveyKpiTile
          label="Total surveys"
          value={
            statsLoading && workspaceStats == null
              ? '…'
              : String(workspaceStats?.totalSurveys ?? items.length)
          }
          hint="Active in workspace"
          tone="brand"
          icon={<ClipboardList className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
        />
        <SurveyKpiTile
          label="Responses"
          value={
            statsLoading && workspaceStats == null
              ? '…'
              : String(workspaceStats?.totalResponses ?? 0)
          }
          hint="Collected so far"
          tone="cyan"
          icon={<MessageSquareText className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
        />
        <SurveyKpiTile
          label="Completion rate"
          value={
            statsLoading && workspaceStats == null
              ? '…'
              : formatKpi(workspaceStats?.completionRate, '%')
          }
          hint="HCP Beta feedback vs approved"
          tone="slate"
          icon={<Percent className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
        />
        <SurveyKpiTile
          label="Avg ease score"
          value={
            statsLoading && workspaceStats == null
              ? '…'
              : formatKpi(workspaceStats?.averageEaseScore)
          }
          hint="1–5 across beta stages"
          tone="amber"
          icon={<Smile className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
        />
        <SurveyKpiTile
          label="NPS"
          value={
            statsLoading && workspaceStats == null
              ? '…'
              : formatKpi(workspaceStats?.npsScore)
          }
          hint="HCP Beta recommend score"
          tone="rose"
          icon={<Star className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
        />
      </SurveyKpiStrip>

      <div className="grid gap-4 lg:grid-cols-5">
        <SurveyAttentionList items={attentionItems} className="lg:col-span-2" />
        <SurveyTrendSparkline
          points={workspaceStats?.trend ?? []}
          className="lg:col-span-3"
        />
      </div>

      <section className="overflow-hidden rounded-card border border-border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Survey templates</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Native intake and feedback forms you can browse, edit, or reuse on a program hub.
            </p>
          </div>
          <SurveyFilterSelect
            label="Type"
            value={templateType}
            onChange={(v) => setTemplateType(v as 'all' | 'INTAKE' | 'FEEDBACK')}
          >
            <option value="all">All types</option>
            <option value="INTAKE">Intake</option>
            <option value="FEEDBACK">Feedback</option>
          </SurveyFilterSelect>
        </div>
        {templatesLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : templatesError ? (
          <p className="px-4 py-6 text-sm text-destructive">Could not load templates. Try again.</p>
        ) : templates.length === 0 ? (
          <SurveyEmptyState
            className="border-0 shadow-none"
            title="No reusable templates yet"
            description="Create or customize a survey on a program, then it appears here for browsing and cloning."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Program
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Responses
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/60">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {t.title}
                        {t.isCustomized ? (
                          <SurveyStatusPill kind="customized">Customized</SurveyStatusPill>
                        ) : (
                          <SurveyStatusPill kind="native">Native</SurveyStatusPill>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.program.title}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {t.responseCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={`/admin/surveys/${t.id}?tab=questions`}
                          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          Edit
                        </Link>
                        <Link
                          to={`/admin/programs/${t.program.id}/hub`}
                          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                        >
                          Program hub
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SurveyFilterBar
        search={listQuery.q}
        onSearchChange={(q) => patchListQuery({ q })}
        searchPlaceholder="Search all surveys…"
        trailing={
          surveyListQueryIsActive(listQuery) ? (
            <button
              type="button"
              onClick={clearListQuery}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Clear filters
            </button>
          ) : null
        }
        filters={
          <>
            <SurveyFilterSelect
              label="Program"
              value={listQuery.program}
              onChange={(program) => patchListQuery({ program })}
            >
              <option value="all">All programs</option>
              {programOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </SurveyFilterSelect>
            <SurveyFilterSelect
              label="Session"
              value={listQuery.session}
              onChange={(session) =>
                patchListQuery({
                  session: session as SurveyListQueryState['session'],
                })
              }
            >
              <option value="all">All sessions</option>
              <option value="WEBINAR">Webinar</option>
              <option value="MEETING">Office hours</option>
            </SurveyFilterSelect>
            <SurveyFilterSelect
              label="Status"
              value={listQuery.status}
              onChange={(status) =>
                patchListQuery({
                  status: status as SurveyListQueryState['status'],
                })
              }
            >
              <option value="all">All statuses</option>
              <option value="collecting">Collecting</option>
              <option value="no_responses">No responses</option>
            </SurveyFilterSelect>
            <SurveyFilterSelect
              label="Source"
              value={listQuery.source}
              onChange={(source) =>
                patchListQuery({
                  source: source as SurveyListQueryState['source'],
                })
              }
            >
              <option value="all">All sources</option>
              <option value="native">Native</option>
              <option value="jotform">Jotform</option>
            </SurveyFilterSelect>
            <SurveyFilterSelect
              label="Sort"
              value={listQuery.sort}
              onChange={(sort) =>
                patchListQuery({
                  sort: sort as SurveyListQueryState['sort'],
                })
              }
            >
              <option value="created">Created</option>
              <option value="name">Name</option>
              <option value="responses">Responses</option>
              <option value="completion">Completion</option>
            </SurveyFilterSelect>
            <SurveyFilterSelect
              label="Dir"
              value={listQuery.dir}
              onChange={(dir) =>
                patchListQuery({
                  dir: dir as SurveyListQueryState['dir'],
                })
              }
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </SurveyFilterSelect>
          </>
        }
      />

      {items.length === 0 ? (
        <SurveyEmptyState
          title="No surveys yet"
          description="Create a survey to gather feedback from programs."
          action={
            <Link
              to="/admin/create-survey"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create Survey
            </Link>
          }
        />
      ) : filteredItems.length === 0 ? (
        <SurveyEmptyState
          title="No surveys match"
          description="Try another filter, clear search, or reset the instrument panel."
          action={
            <button
              type="button"
              onClick={clearListQuery}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">All surveys</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filteredItems.length} shown
              {surveyListQueryIsActive(listQuery) ? ' · filtered' : ''}
              {' · '}
              sorted by {listQuery.sort} ({listQuery.dir})
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Survey
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted-foreground">
                    Source
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Responses
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                    Completion
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-muted-foreground">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((s) => {
                  const displayTitle = surveyDisplayName(s);
                  const isJotform = Boolean(s.jotformFormId);
                  const responses = s.responseCount ?? 0;
                  const completion =
                    s.completionRate == null ? '—' : `${s.completionRate}%`;
                  return (
                    <tr
                      key={s.id}
                      className="group border-l-2 border-l-transparent transition-colors hover:border-l-brand-300 hover:bg-muted/60"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{displayTitle}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {responses === 0 ? (
                            <SurveyStatusPill kind="attention">No responses</SurveyStatusPill>
                          ) : (
                            <SurveyStatusPill kind="collecting">Collecting</SurveyStatusPill>
                          )}
                          {s.program?.zoomSessionType === 'MEETING' ? (
                            <SurveyStatusPill kind="draft">Office hours</SurveyStatusPill>
                          ) : s.program?.zoomSessionType === 'WEBINAR' ? (
                            <SurveyStatusPill kind="ready">Webinar</SurveyStatusPill>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.type}</td>
                      <td className="px-4 py-3">
                        {isJotform ? (
                          <SurveyStatusPill kind="jotform">Jotform</SurveyStatusPill>
                        ) : (
                          <SurveyStatusPill kind="native">Native</SurveyStatusPill>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                        {responses}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {completion}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            to={`/admin/surveys/${s.id}?tab=overview`}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-brand-700 opacity-80 transition-colors hover:bg-brand-50 hover:opacity-100"
                          >
                            Open
                            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                          <Link
                            to={`/admin/surveys/${s.id}?tab=questions`}
                            className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, displayTitle)}
                            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
