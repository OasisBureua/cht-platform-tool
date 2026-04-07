import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { programsApi } from '../api/programs';
import { webinarsApi } from '../api/webinars';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, Video, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

export default function OfficeHoursDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const { data: session, isLoading: sessionLoading, isError: sessionError } = useQuery({
    queryKey: ['office-hours', id],
    queryFn: () => webinarsApi.getOfficeHoursById(id!),
    enabled: !!id,
    retry: false,
  });

  const { data: program, isLoading: programLoading } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id && !!session,
    retry: false,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['program-slots', id],
    queryFn: () => programsApi.getSlots(id!),
    enabled: !!id && !!program,
  });

  const { data: myRegistration } = useQuery({
    queryKey: ['program', id, 'registration'],
    queryFn: () => programsApi.getMyRegistration(id!),
    enabled: !!userId && !!id && !!program && program.registrationRequiresApproval,
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => programsApi.getEnrollments(userId),
    enabled: !!userId,
  });

  const enrolled = enrollments?.some((e) => e.programId === id) ?? false;

  const needsRegistrationWizard =
    !!program &&
    (program.registrationRequiresApproval ||
      !!program.jotformIntakeFormUrl?.trim() ||
      !!program.jotformPreEventUrl?.trim() ||
      slots.length > 0);

  const enrollMutation = useMutation({
    mutationFn: () => programsApi.enroll(userId, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'calendly-scheduling'] });
    },
  });

  const { data: calendlyScheduling } = useQuery({
    queryKey: ['program', id, 'calendly-scheduling'],
    queryFn: () => programsApi.getCalendlyScheduling(id!),
    enabled: !!userId && !!id && enrolled && program?.zoomSessionType === 'MEETING',
    retry: false,
  });

  if (sessionLoading) return <LoadingSpinner />;

  if (sessionError || !session) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Session not found</p>
        <Link
          to="/app/chm-office-hours"
          className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to CHM Office Hours
        </Link>
      </div>
    );
  }

  const start = session.startTime ? new Date(session.startTime) : null;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
          CHM Office Hours
        </span>
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">{session.title}</h1>
        {session.hostDisplayName ? (
          <p className="text-sm font-medium text-gray-800">Get time with {session.hostDisplayName}</p>
        ) : null}
        {start && (
          <p className="text-sm text-gray-600">
            {format(start, 'EEEE, MMMM d, yyyy · h:mm a')}
            {session.duration ? ` · ${session.duration} min` : ''}
          </p>
        )}
        <p className="text-gray-600 whitespace-pre-wrap">{session.description}</p>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>How it works:</strong> After registration, join your session directly from this page when
          it&apos;s time. You may wait briefly until the host admits you.
        </div>

        {!programLoading && program?.hasCalendlyScheduling && !enrolled && program.registrationRequiresApproval ? (
          <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            One-on-one scheduling (Calendly) is available here in the app after you register and an administrator
            approves your request.
          </p>
        ) : null}
        {!programLoading &&
        program?.hasCalendlyScheduling &&
        !enrolled &&
        !program.registrationRequiresApproval ? (
          <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            Complete registration for this session to open your Calendly scheduling link.
          </p>
        ) : null}

        {enrolled && calendlyScheduling?.calendlySchedulingUrl ? (
          <a
            href={calendlyScheduling.calendlySchedulingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
          >
            Schedule with Calendly
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}

        {programLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            {myRegistration?.status === 'PENDING' ? (
              <p className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Registration pending admin approval.
                {program?.hasCalendlyScheduling
                  ? ' If approved, a Calendly link will appear on this page for one-on-one scheduling.'
                  : ''}
              </p>
            ) : !enrolled && needsRegistrationWizard ? (
              <Link
                to={`/app/chm-office-hours/${id}/register`}
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Register for this session
              </Link>
            ) : !enrolled ? (
              <button
                type="button"
                onClick={() => enrollMutation.mutate()}
                disabled={!userId || enrollMutation.isPending}
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {enrollMutation.isPending ? 'Saving…' : 'Register for this session'}
              </button>
            ) : session.joinUrl ? (
              <a
                href={session.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                <Video className="h-4 w-4" />
                Join Session
              </a>
            ) : (
              <p className="text-sm text-gray-500">Join link will appear here when available.</p>
            )}
          </div>
        )}

        {!enrolled && userId && (
          <p className="text-xs text-gray-500">Register once, then join your session directly from here.</p>
        )}

        {enrolled && program?.jotformSurveyUrl?.trim() ? (
          <div className="border-t border-gray-200 pt-6 space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Post-event survey</h2>
            <div className="min-h-[360px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
              <iframe
                title="Post-event survey"
                src={program.jotformSurveyUrl}
                className="w-full h-[420px]"
                allow="camera; microphone"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
