import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, Download } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { SurveyAnswersTable } from '../../components/admin/SurveyAnswersTable';
import { SurveyAnalyticsPanel } from '../../components/admin/survey-analytics/SurveyAnalyticsPanel';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { downloadBlob, surveyResponsesDownloadFilename } from '../../utils/download-blob';
import { printSurveyAnalyticsPdf } from '../../utils/survey-analytics-pdf';
import {
  adminSurveyDisplayTitle,
  attendanceStatusLabel,
  registrationStatusClass,
  registrationStatusLabel,
} from '../../utils/admin-survey-display';

function attendanceBadgeClass(att: string | null | undefined): string {
  if (att === 'VERIFIED') return 'bg-green-100 text-green-800';
  if (att === 'DENIED') return 'bg-red-100 text-red-800';
  if (att === 'PENDING_VERIFICATION') return 'bg-amber-50 text-amber-800';
  return 'bg-gray-100 text-gray-500';
}

type SurveyResponsesTab = 'responses' | 'analytics';

export default function AdminSurveyResponses() {
  const { id } = useParams<{ id: string }>();
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [tab, setTab] = useState<SurveyResponsesTab>('responses');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'survey', id, 'responses'],
    queryFn: () => adminApi.listSurveyResponses(id!),
    enabled: !!id,
  });

  if (!id) return null;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-destructive">
        Failed to load survey responses.
      </div>
    );
  }

  const { survey, responses } = data;
  const displayTitle = adminSurveyDisplayTitle(
    survey.program?.title,
    survey.type,
    survey.title,
  );

  const downloadCsv = async () => {
    if (!id) return;
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
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <Link
        to="/admin/surveys"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to surveys
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{displayTitle}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {survey.type} survey
            {survey.program ? (
              <>
                {' '}
                ·{' '}
                <Link
                  to={`/admin/programs/${survey.program.id}/hub?tab=surveys`}
                  className="font-semibold text-foreground underline"
                >
                  {survey.program.title}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {tab === 'analytics' ? (
          <button
            type="button"
            onClick={downloadAnalyticsPdf}
            disabled={responses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={csvDownloading || responses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {csvDownloading ? 'Preparing…' : 'Download CSV'}
          </button>
        )}
      </header>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6" aria-label="Survey responses views">
          {(
            [
              { key: 'responses', label: 'Responses' },
              { key: 'analytics', label: 'Analytics' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={[
                'border-b-2 px-1 pb-3 text-sm font-semibold transition-colors',
                tab === t.key
                  ? 'border-gray-900 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'analytics' ? (
        <SurveyAnalyticsPanel surveyId={id} enabled={tab === 'analytics'} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-card">
          <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Registration</th>
              <th className="py-3 px-4">Attendance</th>
              <th className="py-3 px-4">Submitted</th>
              <th className="py-3 px-4 min-w-[18rem]">Responses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {responses.map((r) => (
              <tr key={r.id}>
                <td className="py-3 px-4 align-top">
                  {r.user.firstName} {r.user.lastName}
                  <div className="text-xs text-muted-foreground">{r.user.email}</div>
                  {r.user.specialty ? (
                    <div className="text-xs text-muted-foreground">{r.user.specialty}</div>
                  ) : null}
                </td>
                <td className="py-3 px-4 align-top">
                  {r.registration ? (
                    <span
                      className={[
                        'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        registrationStatusClass(r.registration.status),
                      ].join(' ')}
                    >
                      {registrationStatusLabel(r.registration.status)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">, </span>
                  )}
                </td>
                <td className="py-3 px-4 align-top">
                  {r.registration?.postEventAttendanceStatus ? (
                    <span
                      className={[
                        'inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        attendanceBadgeClass(r.registration.postEventAttendanceStatus),
                      ].join(' ')}
                    >
                      {attendanceStatusLabel(r.registration.postEventAttendanceStatus)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">, </span>
                  )}
                </td>
                <td className="py-3 px-4 align-top text-muted-foreground whitespace-nowrap">
                  {format(parseISO(r.submittedAt), 'MMM d, yyyy h:mm a')}
                </td>
                <td className="py-3 px-4 align-top">
                  <SurveyAnswersTable answers={r.answers} questionsSchema={survey.questions} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">
              No responses submitted yet.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
