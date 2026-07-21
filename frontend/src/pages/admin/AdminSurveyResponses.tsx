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
import { printSurveyResponsesPdf } from '../../utils/survey-analytics-pdf';
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <Link
        to="/admin/surveys"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to surveys
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{displayTitle}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {survey.type} survey
            {survey.program ? (
              <>
                {' '}
                ·{' '}
                <Link
                  to={`/admin/programs/${survey.program.id}/hub?tab=surveys`}
                  className="font-semibold text-gray-900 underline"
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
            onClick={() => printSurveyResponsesPdf(displayTitle)}
            disabled={responses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Download full PDF
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void downloadCsv()}
            disabled={csvDownloading || responses.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {csvDownloading ? 'Preparing…' : 'Download CSV'}
          </button>
        )}
      </header>

      <div className="border-b border-gray-200">
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
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'analytics' ? (
        <div id="survey-responses-print">
          <div className="hidden print:block print:mb-6">
            <h1 className="text-2xl font-semibold">{displayTitle}</h1>
            <p className="text-sm text-gray-600">
              Survey analytics and complete responses · {responses.length}{' '}
              {responses.length === 1 ? 'response' : 'responses'}
            </p>
          </div>
          <SurveyAnalyticsPanel surveyId={id} enabled={tab === 'analytics'} />
          <section className="hidden print:mt-8 print:block">
            <h2 className="mb-4 border-b border-gray-300 pb-2 text-xl font-semibold text-gray-900">
              Individual responses ({responses.length})
            </h2>
            <div className="space-y-5">
              {responses.map((response, index) => (
                <article
                  key={response.id}
                  className="survey-response-print-card rounded-lg border border-gray-300 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Response {index + 1}: {response.user.firstName}{' '}
                        {response.user.lastName}
                      </h3>
                      <p className="text-xs text-gray-600">{response.user.email}</p>
                      {response.user.specialty ? (
                        <p className="text-xs text-gray-500">
                          {response.user.specialty}
                        </p>
                      ) : null}
                    </div>
                    <p className="whitespace-nowrap text-xs text-gray-600">
                      Submitted{' '}
                      {format(parseISO(response.submittedAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <p className="mb-3 text-xs text-gray-600">
                    Registration:{' '}
                    {response.registration
                      ? registrationStatusLabel(response.registration.status)
                      : 'Not available'}
                    {' · '}Attendance:{' '}
                    {response.registration?.postEventAttendanceStatus
                      ? attendanceStatusLabel(
                          response.registration.postEventAttendanceStatus,
                        )
                      : 'Not available'}
                  </p>
                  <SurveyAnswersTable
                    answers={response.answers}
                    questionsSchema={survey.questions}
                  />
                </article>
              ))}
            </div>
          </section>
          <style>{`
            @media print {
              @page { size: landscape; margin: 12mm; }
              /* Hide chrome; keep print root visible and free to paginate.
                 Do NOT use inset:0 — that clamps height to one viewport and clips the report. */
              body * { visibility: hidden !important; }
              #survey-responses-print,
              #survey-responses-print * { visibility: visible !important; }
              #survey-responses-print {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white;
              }
              #survey-responses-print .survey-response-print-card {
                break-inside: avoid;
                page-break-inside: avoid;
              }
              #survey-responses-print button,
              #survey-responses-print select,
              #survey-responses-print label { display: none !important; }
              #survey-responses-print a {
                color: inherit !important;
                text-decoration: none !important;
                pointer-events: none !important;
              }
              #survey-responses-print a[href]::after { content: none !important; }
            }
          `}</style>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-gray-600">
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
                  <div className="text-xs text-gray-500">{r.user.email}</div>
                  {r.user.specialty ? (
                    <div className="text-xs text-gray-400">{r.user.specialty}</div>
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
                    <span className="text-gray-500">—</span>
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
                    <span className="text-gray-500">—</span>
                  )}
                </td>
                <td className="py-3 px-4 align-top text-gray-600 whitespace-nowrap">
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
            <p className="text-sm text-gray-500 px-4 py-8 text-center">
              No responses submitted yet.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
