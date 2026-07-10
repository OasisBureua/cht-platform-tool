import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { SurveyAnswersTable } from '../../components/admin/SurveyAnswersTable';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import {
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

export default function AdminSurveyResponses() {
  const { id } = useParams<{ id: string }>();

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <Link
        to="/admin/surveys"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to surveys
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{survey.title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {survey.type} survey
          {survey.program ? (
            <>
              {' '}
              ·{' '}
              <Link
                to={`/admin/programs/${survey.program.id}/hub`}
                className="font-semibold text-gray-900 underline"
              >
                {survey.program.title}
              </Link>
            </>
          ) : null}
        </p>
      </header>

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
          <p className="text-sm text-gray-500 px-4 py-8 text-center">No responses submitted yet.</p>
        ) : null}
      </div>
    </div>
  );
}
