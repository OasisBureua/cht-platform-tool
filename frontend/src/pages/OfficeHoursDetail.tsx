import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { programsApi } from '../api/programs';
import { webinarsApi } from '../api/webinars';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { ChevronLeft, Video, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { isPostEventSurveyUnlocked } from '../utils/post-event-survey';
import { buildProgramRegisterHref, readIntakeSubmissionIdFromSearch } from '../utils/intake-return';

export default function OfficeHoursDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  useEffect(() => {
    if (!id) return;
    const sid = readIntakeSubmissionIdFromSearch(location.search);
    if (!sid) return;
    const reg = buildProgramRegisterHref(id, location.pathname);
    navigate(`${reg}${location.search}`, { replace: true });
  }, [id, location.pathname, location.search, navigate]);

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
    enabled: !!userId && !!id && !!program,
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false),
  });

  const { data: liveActionItems = [] } = useQuery({
    queryKey: ['programs', 'live-action-items'],
    queryFn: () => programsApi.getLiveActionItems(),
    enabled: !!userId && !!program,
    staleTime: 30_000,
  });

  const pollWhileRegistrationPending = myRegistration?.status === 'PENDING';

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => programsApi.getEnrollments(userId),
    enabled: !!userId,
    refetchInterval: pollWhileRegistrationPending ? 4000 : false,
  });

  const enrolled = enrollments?.some((e) => e.programId === id) ?? false;

  const myEnrollment = enrollments?.find((e) => e.programId === id);
  const videoCount = program?.videos?.length ?? 0;
  const videosDone =
    !!enrolled &&
    (videoCount === 0 ||
      myEnrollment?.completed === true ||
      (myEnrollment?.overallProgress ?? 0) >= 99.5);

  const postEventReminder = liveActionItems.find(
    (a) => a.programId === id && a.kind === 'WEBINAR_POST_EVENT_SURVEY',
  );
  const hasPostEventSurvey = !!program?.jotformSurveyUrl?.trim();
  const postEventSurveyWindowOpen =
    !!program && hasPostEventSurvey && isPostEventSurveyUnlocked(program);
  const surveyDone =
    enrolled &&
    (!hasPostEventSurvey || (postEventSurveyWindowOpen && !postEventReminder));

  const registrationPendingApproval = myRegistration?.status === 'PENDING';

  const needsRegistrationWizard =
    !!program &&
    (program.registrationRequiresApproval ||
      !!program.jotformIntakeFormUrl?.trim() ||
      slots.length > 0);

  const enrollMutation = useMutation({
    mutationFn: () => programsApi.enroll(userId, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
      queryClient.invalidateQueries({ queryKey: ['program', id, 'registration'] });
    },
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
          <strong>How it works:</strong> Complete registration (and pick a time slot if offered). An administrator
          approves your request; then join from this page via Zoom when it&apos;s time. You may wait briefly until the
          host admits you.
        </div>

        {programLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            {registrationPendingApproval ? (
              <p className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Your registration is waiting for an administrator to approve it. Join unlocks below after approval—this
                page updates automatically.
              </p>
            ) : !enrolled && needsRegistrationWizard ? (
              <Link
                to={`/app/chm-office-hours/${id}/register`}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Register for this session
              </Link>
            ) : !enrolled ? (
              <button
                type="button"
                onClick={() => enrollMutation.mutate()}
                disabled={!userId || enrollMutation.isPending}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {enrollMutation.isPending ? 'Saving…' : 'Register for this session'}
              </button>
            ) : null}

            {session.joinUrl ? (
              enrolled ? (
                <a
                  href={session.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  <Video className="h-4 w-4" />
                  Join session
                  <ExternalLink className="h-4 w-4 opacity-90" />
                </a>
              ) : registrationPendingApproval ? (
                <button
                  type="button"
                  disabled
                  className="inline-flex w-fit cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500"
                  title="Available after an administrator approves your registration."
                >
                  <Video className="h-4 w-4" />
                  Join session
                  <ExternalLink className="h-4 w-4 opacity-60" />
                </button>
              ) : null
            ) : (
              <p className="text-sm text-gray-500">Join link will appear here when available.</p>
            )}
          </div>
        )}

        {!enrolled && userId && !registrationPendingApproval && (
          <p className="text-xs text-gray-500">Register once, then join your session directly from here.</p>
        )}

        {!programLoading && program ? (
          <div className="border-t border-gray-200 pt-6 max-w-2xl">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold text-gray-600">Requirements</p>
              <ul className="mt-4 space-y-3">
                <OfficeHoursRequirementRow
                  label="Register for the activity"
                  done={enrolled}
                  pendingApproval={!enrolled && registrationPendingApproval}
                />
                <OfficeHoursRequirementRow
                  label="Complete all required videos in Conversations"
                  done={videosDone}
                  locked={!enrolled}
                />
                <OfficeHoursRequirementRow
                  label="Complete required survey"
                  done={surveyDone}
                  locked={!enrolled}
                />
              </ul>
              {!enrolled && !registrationPendingApproval ? (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">Register to unlock content and survey completion.</p>
                </div>
              ) : null}
              {!enrolled && registrationPendingApproval ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-900">
                    You&apos;re registered—waiting for admin approval. Conversations and surveys unlock after approval.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {enrolled && program?.jotformSurveyUrl?.trim() && program && isPostEventSurveyUnlocked(program) ? (
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
        ) : enrolled && program?.jotformSurveyUrl?.trim() ? (
          <div className="border-t border-gray-200 pt-6 text-sm text-gray-600">
            <p className="font-medium text-gray-900">Post-event survey</p>
            <p className="mt-1">
              Unlocks after this office hours session ends in Zoom (or right away if no end time was recorded yet).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function OfficeHoursRequirementRow(props: {
  label: string;
  done?: boolean;
  locked?: boolean;
  pendingApproval?: boolean;
}) {
  const { label, done, locked, pendingApproval } = props;
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className={['h-5 w-5', locked ? 'text-gray-200' : 'text-gray-300'].join(' ')} />
        )}
        <span className={['text-sm truncate', locked ? 'text-gray-400' : 'text-gray-700'].join(' ')}>{label}</span>
      </div>
      {done ? (
        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
          Done
        </span>
      ) : pendingApproval ? (
        <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-1">
          Pending approval
        </span>
      ) : locked ? (
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
          Locked
        </span>
      ) : (
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
          Pending
        </span>
      )}
    </li>
  );
}
