import { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { programsApi } from '../api/programs';
import { isPostEventSurveyUnlocked } from '../utils/post-event-survey';
import PostEventParticipantFlow from '../components/programs/PostEventParticipantFlow';
import SessionDisclaimerNotice from '../components/programs/SessionDisclaimerNotice';
import { webinarsApi } from '../api/webinars';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Award,
  DollarSign,
  ChevronLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  Video,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { buildProgramRegisterHref, readIntakeSubmissionIdFromSearch } from '../utils/intake-return';

function formatMoney(value?: number | null) {
  if (!value) return '$0';
  return `$${value.toLocaleString()}`;
}

function formatEventDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatEventTime(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

function humanStatus(status: string) {
  const map: Record<string, string> = {
    PUBLISHED: 'Published',
    DRAFT: 'Draft',
    ARCHIVED: 'Archived',
    COMPLETED: 'Completed',
  };
  return map[status] ?? status;
}

export default function WebinarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const isAdmin = user?.role === 'ADMIN';
  const [postEventNavLock, setPostEventNavLock] = useState(false);
  const isZoomWebinar = id?.startsWith('zoom-') ?? false;
  /** Intake often redirects to the session page; forward submission id to the registration wizard. */
  useEffect(() => {
    if (!id || isZoomWebinar) return;
    const sid = readIntakeSubmissionIdFromSearch(location.search);
    if (!sid) return;
    const reg = buildProgramRegisterHref(id, location.pathname);
    navigate(`${reg}${location.search}`, { replace: true });
  }, [id, isZoomWebinar, location.pathname, location.search, navigate]);

  const { data: zoomWebinar, isLoading: zoomLoading } = useQuery({
    queryKey: ['webinar', id],
    queryFn: () => webinarsApi.getById(id!),
    enabled: !!id && isZoomWebinar,
    retry: false,
  });

  const {
    data: program,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.getById(id!),
    enabled: !!id && !isZoomWebinar,
    retry: false,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ['program-slots', id],
    queryFn: () => programsApi.getSlots(id!),
    enabled: !!id && !isZoomWebinar && program?.zoomSessionType === 'MEETING',
  });

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => programsApi.getEnrollments(userId),
    enabled: !!userId,
    refetchInterval: () => {
      const reg = queryClient.getQueryData<Awaited<ReturnType<typeof programsApi.getMyRegistration>>>([
        'program',
        id,
        'registration',
      ]);
      return reg?.status === 'PENDING' ? 4000 : false;
    },
  });

  const enrolledProgramIds = useMemo(
    () => new Set(enrollments?.map((e) => e.programId) || []),
    [enrollments],
  );

  const pollRegistrationWhilePendingOrAwaitingPostEventWebhook = (
    registration:
      | Awaited<ReturnType<typeof programsApi.getMyRegistration>>
      | null
      | undefined,
  ): number | false => {
    if (registration?.status === 'PENDING') return 4000;
    const enrolledHere = id ? enrolledProgramIds.has(id) : false;
    if (
      enrolledHere &&
      program?.jotformSurveyUrl?.trim() &&
      registration?.status === 'APPROVED' &&
      !registration.postEventSurveyAcknowledgedAt &&
      !registration.postEventJotformSubmissionId &&
      (registration.postEventAttendanceStatus === 'VERIFIED' ||
        registration.postEventAttendanceStatus === 'NOT_REQUIRED')
    ) {
      return 4000;
    }
    return false;
  };

  const { data: myRegistration } = useQuery({
    queryKey: ['program', id, 'registration'],
    queryFn: () => programsApi.getMyRegistration(id!),
    enabled:
      !!userId &&
      !!id &&
      !isZoomWebinar &&
      !!program &&
      (program.zoomSessionType === 'WEBINAR' || program.zoomSessionType === 'MEETING'),
    refetchInterval: (q) => pollRegistrationWhilePendingOrAwaitingPostEventWebhook(q.state.data ?? undefined),
  });

  const enrollMutation = useMutation({
    mutationFn: ({ programId }: { programId: string }) =>
      programsApi.enroll(userId, programId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
      queryClient.invalidateQueries({ queryKey: ['program', vars.programId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
    },
  });

  const { data: liveActionItems = [] } = useQuery({
    queryKey: ['programs', 'live-action-items'],
    queryFn: () => programsApi.getLiveActionItems(),
    enabled: !!userId && !isZoomWebinar,
    staleTime: 30_000,
  });

  if (isZoomWebinar) {
    if (zoomLoading) return <LoadingSpinner />;
    if (!zoomWebinar) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-semibold text-gray-900">Session not found</p>
          <Link to="/app/live" className="mt-5 inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700">
            Back to LIVE
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-8 pb-24 md:pb-0">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Live
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">{zoomWebinar.title}</h1>
          <p className="mt-3 text-gray-600">{zoomWebinar.description}</p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Use a scheduled Live webinar in the app</p>
            <p className="mt-1 text-amber-900">
              CME registration, admin approval, and honorarium payouts run through platform webinars. Raw Zoom-only
              listings do not support that workflow.
            </p>
          </div>
          {zoomWebinar.joinUrl ? (
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={zoomWebinar.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
              >
                Join session
              </a>
              <p className="text-xs text-gray-600">
                Or use a direct host or panel link from your invite if you were given one.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">We could not load this session.</p>
        <p className="mt-1 text-sm text-gray-600">
          {String((error as any)?.message || 'Please try again.')}
        </p>
        <div className="mt-5">
          <Link
            to="/app/live"
            className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
          >
            Back to Live
          </Link>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Session not found</p>
        <p className="mt-1 text-sm text-gray-600">That link may be invalid.</p>
        <div className="mt-5">
          <Link
            to="/app/live"
            className="inline-flex items-center justify-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
          >
            Back to Live
          </Link>
        </div>
      </div>
    );
  }

  const enrolled = enrolledProgramIds.has(program.id);

  const myEnrollment = enrollments?.find((e) => e.programId === program.id);
  const videoCount = program.videos?.length ?? 0;
  const videosDone =
    enrolled &&
    (videoCount === 0 ||
      myEnrollment?.completed === true ||
      (myEnrollment?.overallProgress ?? 0) >= 99.5);

  const postEventReminder = liveActionItems.find(
    (a) => a.programId === program.id && a.kind === 'WEBINAR_POST_EVENT_SURVEY',
  );

  const hasPostEventSurvey = !!program.jotformSurveyUrl?.trim();
  const postEventSurveyWindowOpen = hasPostEventSurvey && isPostEventSurveyUnlocked(program);
  const wantsPostEventExtras =
    hasPostEventSurvey || !!(program.honorariumAmount && program.honorariumAmount > 0);
  const surveyDone =
    enrolled &&
    (!hasPostEventSurvey || (postEventSurveyWindowOpen && !postEventReminder));
  const surveyInProgress =
    enrolled &&
    hasPostEventSurvey &&
    !surveyDone &&
    !!myRegistration?.postEventJotformSubmissionId &&
    !myRegistration?.postEventSurveyAcknowledgedAt;

  const registrationPendingApproval = myRegistration?.status === 'PENDING';
  const showJoinSessionCard =
    program.zoomSessionType === 'WEBINAR' && (enrolled || registrationPendingApproval);

  /** Live webinars always use the registration wizard so intake (when configured) is not skipped via quick enroll. */
  const needsRegistrationWizard =
    !!program &&
    (program.zoomSessionType === 'WEBINAR' ||
      (program.zoomSessionType === 'MEETING' &&
        (slots.length > 0 ||
          !!program.jotformIntakeFormUrl?.trim() ||
          !!program.registrationRequiresApproval)));

  const ctaLabel = enrolled
    ? 'Registered'
    : enrollMutation.isPending
    ? 'Registering…'
    : 'Register Now';

  const ctaDisabled =
    enrolled ||
    enrollMutation.isPending ||
    myRegistration?.status === 'PENDING';

  const attendanceAllowsPostEvent =
    myRegistration?.postEventAttendanceStatus === 'VERIFIED' ||
    myRegistration?.postEventAttendanceStatus === 'NOT_REQUIRED';
  const showPostEventReminderBanner =
    program.zoomSessionType === 'WEBINAR' &&
    postEventReminder &&
    enrolled &&
    wantsPostEventExtras &&
    isPostEventSurveyUnlocked(program) &&
    attendanceAllowsPostEvent &&
    myRegistration?.postEventAttendanceStatus !== 'PENDING_VERIFICATION' &&
    myRegistration?.postEventAttendanceStatus !== 'DENIED';

  const sessionCoverUrl =
    program.sessionHeroImageUrl?.trim() || program.thumbnailUrl?.trim() || '';

  const registerCtaClass =
    'inline-flex w-full max-w-full shrink-0 justify-center rounded-lg px-[26px] py-2.5 text-sm font-semibold min-w-[172px] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] sm:w-fit';

  const pendingRegistrationMessage =
    myRegistration?.status === 'PENDING'
      ? myRegistration.intakeJotformSubmissionId
        ? 'Your registration survey was received. Waiting for an administrator to approve you before you can join the webinar in the app.'
        : 'Registration is pending. Complete the survey if you have not yet, then wait for approval.'
      : null;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {!postEventNavLock ? (
        <div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Live
          </button>
        </div>
      ) : null}

      {showPostEventReminderBanner ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Post-event follow-up</p>
          <p className="mt-1 text-amber-900">
            Complete remaining steps on this page after the session (survey and/or honorarium confirmation). You can also
            open the{' '}
            <Link to="/app/surveys" className="font-semibold underline">
              Surveys
            </Link>{' '}
            tab for linked feedback surveys. This may appear under the header notifications (bell).
          </p>
        </div>
      ) : null}

      {/* Header / Overview — Variation B: register left, full-height cover rail right */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="p-4 sm:p-6">
          <div className="flex min-h-[17.5rem] flex-row items-stretch gap-3 min-[480px]:gap-4 sm:min-h-[20rem] sm:gap-6 md:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
                Live
              </span>
              <span className="text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                {humanStatus(program.status)}
              </span>
              {program.accreditationBody ? (
                <span className="text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                  {program.accreditationBody}
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="text-balance text-xl font-bold leading-tight text-gray-900 min-[480px]:text-2xl md:text-3xl">
              {program.title}
            </h1>

            {/* Description */}
            {program.description ? (
              <p className="text-base text-gray-700 leading-relaxed">{program.description}</p>
            ) : null}

            {program.sessionDisclaimer?.trim() ? (
              <SessionDisclaimerNotice text={program.sessionDisclaimer.trim()} />
            ) : null}

            {/* Speaker / Host */}
            {program.hostDisplayName ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="text-sm text-gray-500 font-medium">Speaker</span>
                  <span className="text-sm font-semibold text-gray-900">{program.hostDisplayName}</span>
                </div>
                {program.hostBio ? (
                  <p className="pl-6 text-sm text-gray-600">{program.hostBio}</p>
                ) : null}
              </div>
            ) : null}

            {/* Date / time */}
            {program.startDate ? (
              <div className="flex flex-col gap-1 text-xs text-gray-600 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                  {formatEventDate(program.startDate)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  {formatEventTime(program.startDate)}
                  {program.duration ? <span className="text-gray-400">· {program.duration} min</span> : null}
                </span>
              </div>
            ) : null}

            {/* Reward chips */}
            <div className="flex flex-wrap items-center gap-2">
              {program.creditAmount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2.5 py-1">
                  <Award className="h-3.5 w-3.5" />
                  {program.creditAmount} CME Credits
                </span>
              ) : null}
              {program.honorariumAmount ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  {formatMoney(program.honorariumAmount)} honorarium
                </span>
              ) : null}
            </div>

            {myRegistration?.status !== 'PENDING' ? (
              needsRegistrationWizard && !enrolled && !userId ? (
                <Link
                  to="/login"
                  state={{ from: { pathname: `/app/live/${program.id}` } }}
                  className={`${registerCtaClass} bg-gray-900 text-white hover:bg-black`}
                >
                  Sign in to register
                </Link>
              ) : needsRegistrationWizard && !enrolled ? (
                <Link
                  to={`/app/live/${program.id}/register`}
                  className={`${registerCtaClass} bg-orange-600 text-white hover:bg-orange-700`}
                >
                  Register
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => enrollMutation.mutate({ programId: program.id })}
                  disabled={ctaDisabled}
                  className={[
                    registerCtaClass,
                    ctaDisabled
                      ? 'cursor-not-allowed bg-gray-200 text-gray-600'
                      : 'bg-orange-600 text-white hover:bg-orange-700',
                  ].join(' ')}
                >
                  {ctaLabel}
                </button>
              )
            ) : null}

            {!enrolled && myRegistration?.status !== 'PENDING' && needsRegistrationWizard ? (
              <p className="text-pretty text-[11px] leading-relaxed text-gray-600 sm:text-xs">
                Complete registration here. Post-event surveys appear on the Surveys tab after the live session.
              </p>
            ) : null}
            {!enrolled && myRegistration?.status !== 'PENDING' && !needsRegistrationWizard ? (
              <p className="text-pretty text-[11px] text-gray-600 sm:text-xs">
                Register to unlock video playback and earn rewards.
              </p>
            ) : null}
            {enrolled ? (
              <p className="text-pretty text-[11px] text-gray-600 sm:text-xs">
                Complete required steps to earn rewards.
              </p>
            ) : null}

            {pendingRegistrationMessage ? (
              <div className="mt-auto w-full max-w-xl pt-1">
                <p className="text-pretty rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 sm:text-sm">
                  {pendingRegistrationMessage}
                </p>
              </div>
            ) : null}
            </div>

            {/* Session cover — right rail, stretches with card height */}
            <div className="flex w-[6.5rem] shrink-0 self-stretch min-[400px]:w-[7.25rem] min-[480px]:w-[8.5rem] sm:w-36 md:w-[11.5rem]">
              <div className="relative min-h-[8rem] w-full flex-1 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-sky-100/90 via-zinc-50 to-teal-100/70 shadow-sm">
                {sessionCoverUrl ? (
                  <img
                    src={sessionCoverUrl}
                    alt={program.title ? `Cover for ${program.title}` : 'Session cover'}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-1.5 text-center text-[10px] font-medium leading-snug text-gray-500 min-[480px]:px-2 min-[480px]:text-[11px] sm:text-xs">
                    Session cover
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {showJoinSessionCard ? (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Live webinar</h2>

          {registrationPendingApproval && !enrolled ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-amber-400 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Registration submitted — pending approval</p>
                  <p className="mt-0.5 text-sm text-amber-800">
                    Your request has been received. An administrator will review it shortly. Your join link will activate here automatically after approval.
                  </p>
                </div>
              </div>
            </div>
          ) : enrolled ? (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-semibold text-green-900">You&apos;re registered and approved — use <strong>Join session</strong> when it&apos;s time.</p>
              </div>
            </div>
          ) : null}
          {program.zoomJoinUrl?.trim() ? (
            enrolled ? (
              <a
                href={program.zoomJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Opens Zoom as an attendee (view-only listener)"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
              >
                <Video className="h-4 w-4" />
                Join session
                <ExternalLink className="h-4 w-4 opacity-90" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500"
                title="Available after an administrator approves your registration."
              >
                <Video className="h-4 w-4" />
                Join session
                <ExternalLink className="h-4 w-4 opacity-60" />
              </button>
            )
          ) : (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              A join link is not available yet. If this persists, contact support so an admin can confirm the Zoom
              webinar is linked to this program.
            </p>
          )}
          {isAdmin && program.zoomStartUrl?.trim() ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-3 space-y-2">
              <p className="text-xs font-semibold text-violet-900">Admin — start as Zoom host</p>
              <p className="text-xs text-violet-800">
                Learners use <strong>Join session</strong> above. This link opens Zoom as the webinar host (use the host
                Zoom account).
              </p>
              <a
                href={program.zoomStartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center justify-center gap-2 rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-100"
              >
                <Video className="h-4 w-4" />
                Open host start link
                <ExternalLink className="h-4 w-4 opacity-90" />
              </a>
            </div>
          ) : null}
        </section>
      ) : null}

      {enrolled && program.honorariumAmount ? (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Payments — honorarium</h2>
          <p className="text-sm text-gray-600">
            Complete your <strong>W-9</strong> and payout profile under Payments so admins can send your honorarium after
            you finish the activity.
          </p>
          <Link
            to="/app/payments"
            className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Open Payments
          </Link>
        </section>
      ) : null}

      <section className="max-w-2xl">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-xs font-semibold text-gray-600">Requirements</p>

          <ul className="mt-4 space-y-3">
            <RequirementRow
              label="Register for the activity"
              done={enrolled}
              pendingApproval={!enrolled && registrationPendingApproval}
            />
            <RequirementRow
              label="Complete all required videos in Conversations"
              done={videosDone}
              locked={!enrolled}
            />
            <RequirementRow
              label="Complete required survey"
              done={surveyDone}
              inProgress={surveyInProgress}
              locked={!enrolled}
            />
          </ul>

          {!enrolled && !registrationPendingApproval ? (
            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-600">Register to unlock content and survey completion.</p>
            </div>
          ) : null}
          {!enrolled && registrationPendingApproval ? (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-900">
                You&apos;re registered—waiting for admin approval. Conversations and surveys unlock after approval.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {program && userId ? (
        <PostEventParticipantFlow
          program={program}
          userId={userId}
          enrolled={enrolled}
          myRegistration={myRegistration}
          onPostEventNavLockChange={setPostEventNavLock}
        />
      ) : null}

      {enrolled &&
      wantsPostEventExtras &&
      !isPostEventSurveyUnlocked(program) &&
      program.zoomSessionType === 'WEBINAR' ? (
        <section className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Post-event steps</p>
          <p className="mt-1">These unlock after the live session ends (or once attendance is verified, if required).</p>
        </section>
      ) : null}

      {/* Sticky CTA (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white p-3">
        <div className="mx-auto max-w-7xl px-2 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{program.title}</p>
            <p className="text-xs text-gray-600 truncate">
              {program.honorariumAmount ? `${formatMoney(program.honorariumAmount)} honorarium` : 'Honorarium available'} •{' '}
              {program.creditAmount} CME
            </p>
          </div>

          {myRegistration?.status === 'PENDING' ? (
            <span className="ml-auto text-xs font-medium text-amber-800">Pending approval</span>
          ) : needsRegistrationWizard && !enrolled && !userId ? (
            <Link
              to="/login"
              state={{ from: { pathname: `/app/live/${program.id}` } }}
              className="ml-auto shrink-0 rounded-lg px-4 py-2 text-sm font-semibold bg-gray-900 text-white"
            >
              Sign in
            </Link>
          ) : needsRegistrationWizard && !enrolled ? (
            <Link
              to={`/app/live/${program.id}/register`}
              className="ml-auto shrink-0 rounded-lg bg-orange-600 px-[26px] py-2 text-sm font-semibold text-white min-w-[172px] text-center"
            >
              Register
            </Link>
          ) : (
            <button
              onClick={() => enrollMutation.mutate({ programId: program.id })}
              disabled={ctaDisabled}
              className={[
                'ml-auto shrink-0 rounded-lg px-4 py-2 text-sm font-semibold',
                ctaDisabled
                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]',
              ].join(' ')}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RequirementRow(props: {
  label: string;
  done?: boolean;
  /** Survey Jotform submitted but "Complete survey" not yet clicked */
  inProgress?: boolean;
  /** No access until admin approves registration */
  locked?: boolean;
  /** Registration submitted; waiting on admin */
  pendingApproval?: boolean;
}) {
  const { label, done, inProgress, locked, pendingApproval } = props;

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : inProgress ? (
          <CheckCircle2 className="h-5 w-5 text-blue-500" />
        ) : (
          <Circle className={['h-5 w-5', locked ? 'text-gray-200' : 'text-gray-300'].join(' ')} />
        )}
        <span className={['text-sm truncate', locked ? 'text-gray-400' : 'text-gray-700'].join(' ')}>
          {label}
        </span>
      </div>
      {done ? (
        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
          Done
        </span>
      ) : inProgress ? (
        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-1">
          In progress
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
