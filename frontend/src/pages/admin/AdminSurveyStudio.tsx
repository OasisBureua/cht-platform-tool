import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Download, Loader2 } from 'lucide-react';
import { surveysApi } from '../../api/surveys';
import { adminApi } from '../../api/admin';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import {
  SurveyStudioTabs,
  SurveyStatusPill,
  SurveyStudioPreview,
  SurveyStudioOverview,
  SURVEY_STUDIO_SEGMENTS,
  surveyStudioPanelId,
  type SurveyStudioTab,
} from '../../components/admin/survey-workspace';
import { adminSurveyDisplayTitle } from '../../utils/admin-survey-display';
import { downloadBlob, surveyResponsesDownloadFilename } from '../../utils/download-blob';
import { AdminEditSurveyForm } from './AdminEditSurvey';
import AdminSurveyResponses from './AdminSurveyResponses';
import { SurveyAnalyticsPanel } from '../../components/admin/survey-analytics/SurveyAnalyticsPanel';

const STUDIO_TABS: SurveyStudioTab[] = [
  'overview',
  'questions',
  'responses',
  'results',
  'preview',
  'settings',
];

function tabFromSearch(raw: string | null): SurveyStudioTab {
  if (raw && STUDIO_TABS.includes(raw as SurveyStudioTab)) {
    return raw as SurveyStudioTab;
  }
  return 'overview';
}

function surveyTypeLabel(type: string): string {
  if (type === 'INTAKE') return 'Registration';
  if (type === 'FEEDBACK') return 'Post-event';
  return type.replace(/_/g, ' ');
}

export default function AdminSurveyStudio() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabFromSearch(searchParams.get('tab'));
  const [csvDownloading, setCsvDownloading] = useState(false);

  const setTab = useCallback(
    (next: SurveyStudioTab) => {
      const params = new URLSearchParams(searchParams);
      if (next === 'overview') params.delete('tab');
      else params.set('tab', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const {
    data: survey,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id),
  });

  const { data: responsePage } = useQuery({
    queryKey: ['admin', 'survey', id, 'responses', 1, 10],
    queryFn: () => adminApi.listSurveyResponses(id!, { page: 1, pageSize: 10 }),
    enabled: Boolean(id),
  });

  const displayTitle = useMemo(() => {
    if (!survey) return 'Survey';
    return adminSurveyDisplayTitle(survey.program?.title, survey.type, survey.title);
  }, [survey]);

  const responseCount =
    responsePage?.pagination?.total ?? survey?.responseCount ?? 0;

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

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !survey) {
    return (
      <div className="rounded-card border border-border bg-muted p-10 text-center">
        <p className="font-semibold text-foreground">Survey not found</p>
        <Link
          to="/admin/surveys"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to surveys
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="sticky top-0 z-20 -mx-1 space-y-4 rounded-card border border-border bg-card/95 p-3 shadow-card backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-2">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Link
                to="/admin/surveys"
                className="inline-flex items-center gap-1 rounded-[4px] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Surveys
              </Link>
              <span aria-hidden>/</span>
              <span className="truncate font-medium text-foreground">{displayTitle}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              <SurveyStatusPill kind="collecting">{surveyTypeLabel(survey.type)}</SurveyStatusPill>
              {survey.jotformFormId ? (
                <SurveyStatusPill kind="jotform">Jotform</SurveyStatusPill>
              ) : (
                <SurveyStatusPill kind="native">Native</SurveyStatusPill>
              )}
              {responseCount === 0 ? (
                <SurveyStatusPill kind="attention">No responses</SurveyStatusPill>
              ) : (
                <SurveyStatusPill kind="ready">
                  {responseCount.toLocaleString()} responses
                </SurveyStatusPill>
              )}
            </div>
            <h1 className="text-balance text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {displayTitle}
            </h1>
            {survey.program ? (
              <p className="text-sm text-muted-foreground">
                Webinar{' '}
                <Link
                  to={`/admin/programs/${survey.program.id}/hub?tab=surveys`}
                  className="rounded-[4px] font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {survey.program.title}
                </Link>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Not linked to a webinar</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void downloadCsv()}
              disabled={csvDownloading || responseCount === 0}
            >
              {csvDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
              {csvDownloading ? 'Preparing…' : 'Export CSV'}
            </Button>
          </div>
        </div>
        <SurveyStudioTabs value={tab} onChange={setTab} />
      </div>

      <div
        id={surveyStudioPanelId(tab)}
        role="tabpanel"
        aria-label={
          SURVEY_STUDIO_SEGMENTS.find((s) => s.value === tab)?.label ?? tab
        }
        className="min-w-0"
      >
        {tab === 'overview' ? (
          <SurveyStudioOverview
            survey={survey}
            responseCount={responseCount}
            lastResponseAt={responsePage?.responses?.[0]?.submittedAt ?? null}
            onOpenTab={setTab}
          />
        ) : null}

        {tab === 'questions' ? (
          <AdminEditSurveyForm
            key={`${survey.id}-questions`}
            survey={survey}
            embedded
            sections="questions"
          />
        ) : null}

        {tab === 'settings' ? (
          <AdminEditSurveyForm
            key={`${survey.id}-settings`}
            survey={survey}
            embedded
            sections="settings"
          />
        ) : null}

        {tab === 'responses' ? (
          <AdminSurveyResponses embedded forceTab="responses" hideCsvButton />
        ) : null}

        {tab === 'results' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Per-question charts, ease by stage, and NPS for this survey. Jump in from the dashboard
              in three clicks or fewer.
            </p>
            <SurveyAnalyticsPanel surveyId={id} enabled variant="studio" />
          </div>
        ) : null}

        {tab === 'preview' ? <SurveyStudioPreview survey={survey} /> : null}
      </div>
    </div>
  );
}

