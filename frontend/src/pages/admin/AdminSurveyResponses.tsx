import { Link, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  Inbox,
} from 'lucide-react';
import { adminApi } from '../../api/admin';
import { SurveyAnswersTable } from '../../components/admin/SurveyAnswersTable';
import { SurveyAnalyticsPanel } from '../../components/admin/survey-analytics/SurveyAnalyticsPanel';
import { Button } from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import TablePagination from '../../components/ui/TablePagination';
import { downloadBlob, surveyResponsesDownloadFilename } from '../../utils/download-blob';
import { printSurveyAnalyticsPdf } from '../../utils/survey-analytics-pdf';
import {
  adminSurveyDisplayTitle,
  attendanceStatusLabel,
  registrationStatusClass,
  registrationStatusLabel,
  surveyAnswersToRows,
} from '../../utils/admin-survey-display';

const PAGE_SIZE = 10;

function attendanceBadgeClass(att: string | null | undefined): string {
  if (att === 'VERIFIED') return 'bg-green-100 text-success';
  if (att === 'DENIED') return 'bg-red-100 text-destructive';
  if (att === 'PENDING_VERIFICATION') return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
}

function surveyTypeLabel(type: string): string {
  if (type === 'INTAKE') return 'Registration';
  if (type === 'FEEDBACK') return 'Post-event';
  return type.replace(/_/g, ' ');
}

function initials(firstName: string, lastName: string, email: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName.slice(0, 2).toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

type SurveyResponsesTab = 'responses' | 'analytics';

type ResponseRow = {
  id: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    specialty?: string | null;
  };
  registration: {
    status: string;
    postEventAttendanceStatus: string;
  } | null;
};

function StatusPill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold leading-4',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function ResponseItem({
  response,
  questionsSchema,
  surveyType,
  expanded,
  onToggle,
}: {
  response: ResponseRow;
  questionsSchema: unknown;
  surveyType: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const answerRows = surveyAnswersToRows(response.answers, questionsSchema);
  const fullName = `${response.user.firstName} ${response.user.lastName}`.trim() || 'Unknown';
  const submittedAt = parseISO(response.submittedAt);
  const submittedAbsolute = format(submittedAt, 'MMM d, yyyy · h:mm a');
  const submittedRelative = formatDistanceToNow(submittedAt, { addSuffix: true });
  const panelId = `response-answers-${response.id}`;
  const showAttendance = surveyType === 'FEEDBACK';

  return (
    <li
      className={[
        'overflow-hidden rounded-card bg-card shadow-card transition-[box-shadow,background-color] duration-150',
        expanded ? 'shadow-card-hover ring-1 ring-border/80' : 'hover:shadow-card-hover',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-5"
      >
        <div
          className={[
            'mt-0.5 grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold tracking-wide',
            expanded
              ? 'bg-foreground text-background'
              : 'bg-muted text-foreground',
          ].join(' ')}
          aria-hidden
        >
          {initials(response.user.firstName, response.user.lastName, response.user.email)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold text-foreground">{fullName}</p>
            {response.user.specialty ? (
              <>
                <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden>
                  ·
                </span>
                <span className="text-xs text-muted-foreground">{response.user.specialty}</span>
              </>
            ) : null}
          </div>

          <p className="mt-0.5 truncate text-sm text-muted-foreground">{response.user.email}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {response.registration ? (
              <StatusPill className={registrationStatusClass(response.registration.status)}>
                {registrationStatusLabel(response.registration.status)}
              </StatusPill>
            ) : (
              <StatusPill className="bg-muted font-medium text-muted-foreground">
                No registration
              </StatusPill>
            )}
            {showAttendance ? (
              response.registration?.postEventAttendanceStatus ? (
                <StatusPill
                  className={attendanceBadgeClass(
                    response.registration.postEventAttendanceStatus,
                  )}
                >
                  {attendanceStatusLabel(response.registration.postEventAttendanceStatus)}
                </StatusPill>
              ) : (
                <StatusPill className="bg-muted font-medium text-muted-foreground">
                  No attendance
                </StatusPill>
              )
            ) : null}
            <span className="text-[11px] text-muted-foreground sm:hidden">
              {submittedAbsolute}
            </span>
            <span className="hidden text-[11px] text-muted-foreground/70 sm:inline" aria-hidden>
              ·
            </span>
            <span className="text-[11px] text-muted-foreground">
              {answerRows.length} answer{answerRows.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 pt-0.5 text-right sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Submitted
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-foreground">{submittedAbsolute}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{submittedRelative}</p>
        </div>

        <span
          className={[
            'mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-[6px] transition-colors',
            expanded ? 'bg-muted text-foreground' : 'text-muted-foreground',
          ].join(' ')}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <span className="sr-only">{expanded ? 'Hide answers' : 'Show answers'}</span>
        </span>
      </button>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-border/70 bg-muted/25 px-4 pb-5 pt-4 sm:px-5 sm:pl-[4.25rem]"
        >
          {answerRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No answers recorded.</p>
          ) : (
            <SurveyAnswersTable
              answers={response.answers}
              questionsSchema={questionsSchema}
            />
          )}
        </div>
      ) : null}
    </li>
  );
}

export default function AdminSurveyResponses() {
  const { id } = useParams<{ id: string }>();
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [tab, setTab] = useState<SurveyResponsesTab>('responses');
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['admin', 'survey', id, 'responses', page, PAGE_SIZE],
    queryFn: () =>
      adminApi.listSurveyResponses(id!, {
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!id,
  });

  const total = data?.pagination?.total ?? 0;
  const pageSize = data?.pagination?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const responses =
    data?.pagination?.page === page ? (data.responses ?? []) : [];

  const responseIds = useMemo(() => responses.map((r) => r.id), [responses]);

  useEffect(() => {
    setExpandedIds(new Set());
  }, [page]);

  const allExpanded =
    responseIds.length > 0 && responseIds.every((rid) => expandedIds.has(rid));

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  const toggleOne = (responseId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) next.delete(responseId);
      else next.add(responseId);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(responseIds));
  const collapseAll = () => setExpandedIds(new Set());

  if (!id) return null;

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-destructive">
        Failed to load survey responses.
      </div>
    );
  }

  const survey = data.survey;
  const displayTitle = adminSurveyDisplayTitle(
    survey.program?.title,
    survey.type,
    survey.title,
  );

  const downloadCsv = async () => {
    if (!id || !survey) return;
    setCsvDownloading(true);
    try {
      const blob = await adminApi.downloadSurveyResponsesCsv(id);
      downloadBlob(
        blob,
        surveyResponsesDownloadFilename(survey.program?.title ?? '', survey.type),
      );
    } finally {
      setCsvDownloading(false);
    }
  };

  const downloadAnalyticsPdf = () => {
    printSurveyAnalyticsPdf(displayTitle);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <div className="space-y-5">
        <Link
          to="/admin/surveys"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Surveys
        </Link>

        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-[6px] bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                {surveyTypeLabel(survey.type)}
              </span>
              {tab === 'responses' ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {total.toLocaleString()} response{total === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-foreground">
              {displayTitle}
            </h1>
            {survey.program ? (
              <p className="text-sm text-muted-foreground">
                Program{' '}
                <Link
                  to={`/admin/programs/${survey.program.id}/hub?tab=surveys`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {survey.program.title}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not linked to a program</p>
            )}
          </div>

          {tab === 'analytics' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadAnalyticsPdf}
              disabled={total === 0}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void downloadCsv()}
              disabled={csvDownloading || total === 0}
            >
              <Download className="h-4 w-4" />
              {csvDownloading ? 'Preparing…' : 'Download CSV'}
            </Button>
          )}
        </header>

        <SegmentedControl
          label="Survey views"
          value={tab}
          onChange={(next) => {
            setTab(next);
            if (next === 'responses') setPage(1);
          }}
          segments={[
            { value: 'responses', label: 'Responses', count: total },
            { value: 'analytics', label: 'Analytics' },
          ]}
        />
      </div>

      {tab === 'analytics' ? (
        <SurveyAnalyticsPanel surveyId={id} enabled={tab === 'analytics'} />
      ) : total === 0 ? (
        <div className="flex flex-col items-center rounded-card bg-card px-6 py-16 text-center shadow-card">
          <div className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm font-semibold text-foreground">No responses yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Submitted answers will show up here for review.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[8px] bg-app-ground/90 px-1 py-2 backdrop-blur-sm">
            <p className="text-sm text-muted-foreground">
              Showing{' '}
              <span className="font-medium tabular-nums text-foreground">
                {rangeStart}–{rangeEnd}
              </span>{' '}
              of{' '}
              <span className="font-medium tabular-nums text-foreground">
                {total.toLocaleString()}
              </span>
              {isFetching && responses.length > 0 ? (
                <span className="ms-2 text-xs text-muted-foreground">Updating…</span>
              ) : null}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={allExpanded ? collapseAll : expandAll}
              disabled={responses.length === 0}
            >
              {allExpanded ? (
                <ChevronsDownUp className="h-4 w-4" />
              ) : (
                <ChevronsUpDown className="h-4 w-4" />
              )}
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          </div>

          {isFetching && responses.length === 0 ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner />
            </div>
          ) : (
            <ul className="space-y-3">
              {responses.map((r) => (
                <ResponseItem
                  key={r.id}
                  response={r}
                  questionsSchema={survey.questions}
                  surveyType={survey.type}
                  expanded={expandedIds.has(r.id)}
                  onToggle={() => toggleOne(r.id)}
                />
              ))}
            </ul>
          )}

          {totalPages > 1 ? (
            <div className="pt-3">
              <TablePagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
