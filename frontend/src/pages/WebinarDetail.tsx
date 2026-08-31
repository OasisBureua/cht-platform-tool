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
  ChevronLeft,
  CheckCircle2,
  Circle,
  DollarSign,
  ExternalLink,
  MonitorPlay,
  Video,
  Calendar,
  Clock,
  User,
} from 'lucide-react';
import { buildProgramRegisterHref, readIntakeSubmissionIdFromSearch } from '../utils/intake-return';
import { getSessionCoverUrl } from '../utils/session-cover-url';
import { isRegistrationClosed } from '../utils/live-session-timing';

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
    refetchInterval: (query) => {
      const p = query.state.data;
      if (!p) return false;
      if (p.canJoinSession) return 60_000;
      if (!p.joinSessionOpensAt) return false;
      const opensAt = new Date(p.joinSessionOpensAt).getTime();
      if (Number.isNaN(opensAt)) return false;
      const msUntilOpen = opensAt - Date.now();
      if (msUntilOpen > 2 * 60 * 60 * 1000) return false;
      return 15_000;
    },
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
    const enrolledHere =
      (id ? enrolledProgramIds.has(id) : false) ||
      registration?.status === 'APPROVED';
    // Enrollment row may lag briefly after admin approval, keep polling until both agree.
    if (registration?.status === 'APPROVED' && id && !enrolledProgramIds.has(id)) {
      return 4000;
    }
    if (
      enrolledHere &&
      (program?.hasPostEventSurvey || program?.jotformSurveyUrl?.trim()) &&
      registration?.status === 'APPROVED' &&
      !registration.postEventSurveyAcknowledgedAt &&
      !registration.postEventSurveySubmitted &&
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

  // After admin approval, registration flips to APPROVED before enrollments list refreshes.
  // Keep enrollments in sync so the requirements "dots" leave "pending" promptly.
  // Must stay above early returns (Rules of Hooks): otherwise this page white-screens
  // when program data finishes loading / when navigating to Register.
  useEffect(() => {
    if (myRegistration?.status === 'APPROVED' && userId) {
      void queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
    }
  }, [myRegistration?.status, userId, queryClient]);

  if (isZoomWebinar) {
    if (zoomLoading) return <LoadingSpinner />;
    if (!zoomWebinar) {
      return (
        <div className="rounded-card border border-border bg-muted p-10 text-center">
          <p className="font-semibold text-foreground">Session not found</p>
          <Link to="/app/live" className="mt-5 inline-flex rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Back to LIVE
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-8 pb-24 md:pb-0">
        <Link
          to="/app/live"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Live
        </Link>
        <div className="bg-card border border-border rounded-card p-6 space-y-4">
          <h1 className="text-2xl font-bold text-foreground">{zoomWebinar.title}</h1>
          <p className="mt-3 text-muted-foreground">{zoomWebinar.description}</p>
          <div className="rounded-[6px] border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-amber-950">
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
                className="inline-flex w-fit rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
              >
                Join session
              </a>
              <p className="text-xs text-muted-foreground">
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
      <div className="rounded-card border border-border bg-muted p-10 text-center">
        <p className="font-semibold text-foreground">We could not load this session.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {String((error as any)?.message || 'Please try again.')}
        </p>
        <div className="mt-5">
          <Link
            to="/app/live"
            className="inline-flex items-center justify-center rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
          >
            Back to Live
          </Link>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="rounded-card border border-border bg-muted p-10 text-center">
        <p className="font-semibold text-foreground">Session not found</p>
        <p className="mt-1 text-sm text-muted-foreground">That link may be invalid.</p>
        <div className="mt-5">
          <Link
            to="/app/live"
            className="inline-flex items-center justify-center rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
          >
            Back to Live
          </Link>
        </div>
      </div>
    );
  }

  const enrolled =
    enrolledProgramIds.has(program.id) || myRegistration?.status === 'APPROVED';

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

  const hasPostEventSurvey =
    program.hasPostEventSurvey ?? !!program.jotformSurveyUrl?.trim();
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
    !!myRegistration?.postEventSurveySubmitted &&
    !myRegistration?.postEventSurveyAcknowledgedAt;

  const registrationPendingApproval = myRegistration?.status === 'PENDING';
  const surveySubmittedOnly = myRegistration?.status === 'SURVEY_SUBMITTED';
  const showJoinSessionCard =
    program.zoomSessionType === 'WEBINAR' &&
    (enrolled || registrationPendingApproval || surveySubmittedOnly);

  /** Live webinars always use the registration wizard so intake (when configured) is not skipped via quick enroll. */
  const needsRegistrationWizard =
    !!program &&
    (program.zoomSessionType === 'WEBINAR' ||
      (program.zoomSessionType === 'MEETING' &&
        (slots.length > 0 ||
          program.hasIntakeSurvey ||
          !!program.intakeSurveyId ||
          !!program.registrationRequiresApproval)));

  const registrationClosed = isRegistrationClosed(program.startDate);

  const ctaLabel = enrolled
    ? 'Registered'
    : registrationClosed
      ? 'Registration closed'
    : enrollMutation.isPending
    ? 'Registering…'
    : 'Register Now';

  const ctaDisabled =
    enrolled ||
    registrationClosed ||
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

  const sessionCoverUrl = getSessionCoverUrl(program) ?? '';

  const registerCtaClass =
    'inline-flex w-full max-w-full shrink-0 justify-center rounded-[6px] px-[26px] py-2.5 text-sm font-semibold min-w-[172px] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.96] sm:w-fit';

  const pendingRegistrationMessage =
    myRegistration?.status === 'PENDING'
      ? 'Registration is pending administrator approval. Join opens when you are approved and the live session starts.'
      : myRegistration?.status === 'SURVEY_SUBMITTED'
        ? 'Your intake survey was submitted. Finish registration so an administrator can approve you.'
        : null;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {!postEventNavLock ? (
        <div>
          <Link
            to="/app/live"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Live
          </Link>
        </div>
      ) : null}

      {showPostEventReminderBanner ? (
        <div className="rounded-card border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-amber-950">
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

      {/* Header / Overview: Variation B: register left, full-height cover rail right */}
      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="p-4 sm:p-6">
          <div className="flex min-h-[17.5rem] flex-row items-stretch gap-3 min-[480px]:gap-4 sm:min-h-[20rem] sm:gap-6 md:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">

            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-[6px] px-2.5 py-1">
                Live
              </span>
              <span className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-[6px] px-2.5 py-1">
                {humanStatus(program.status)}
              </span>
              {program.accreditationBody ? (
                <span className="text-xs font-medium text-muted-foreground bg-muted border border-border rounded-[6px] px-2.5 py-1">
                  {program.accreditationBody}
                </span>
              ) : null}
            </div>

            {/* Title */}
            <h1 className="text-balance text-xl font-bold leading-tight text-foreground min-[480px]:text-2xl md:text-3xl">
              {program.title}
            </h1>

            {/* Description */}
            {program.description ? (
              <p className="text-base text-muted-foreground leading-relaxed">{program.description}</p>
            ) : null}

            {program.sessionDisclaimer?.trim() ? (
              <SessionDisclaimerNotice text={program.sessionDisclaimer.trim()} />
            ) : null}

            {/* Speaker / Host */}
            {program.hostDisplayName ? (
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground font-medium">Speaker</span>
                  <span className="text-sm font-semibold text-foreground">{program.hostDisplayName}</span>
                </div>
                {program.hostBio ? (
                  <p className="pl-6 text-sm text-muted-foreground">{program.hostBio}</p>
                ) : null}
              </div>
            ) : null}

            {/* Date / time */}
            {program.startDate ? (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:items-center min-[480px]:gap-4 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {formatEventDate(program.startDate)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {formatEventTime(program.startDate)}
                  {program.duration ? <span className="text-muted-foreground">· {program.duration} min</span> : null}
                </span>
              </div>
            ) : null}

            {/* Reward chips */}
            <div className="flex flex-wrap items-center gap-2">
              {program.creditAmount > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted border border-border rounded-[6px] px-2.5 py-1">
                  <Award className="h-3.5 w-3.5" />
                  {program.creditAmount} CME Credits
                </span>
              ) : null}
              {program.honorariumAmount ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-success/10 border border-success/25 rounded-[6px] px-2.5 py-1">
                  <DollarSign className="h-3.5 w-3.5" aria-hidden />
                  {program.honorariumAmount.toLocaleString()} honorarium
                </span>
              ) : null}
            </div>

            {myRegistration?.status !== 'PENDING' ? (
              registrationClosed && !enrolled ? (
                <button
                  type="button"
                  disabled
                  className={`${registerCtaClass} cursor-not-allowed bg-gray-200 text-gray-600`}
                >
                  Registration closed
                </button>
              ) : needsRegistrationWizard && !enrolled && !userId ? (
                <Link
                  to="/login"
                  state={{ from: { pathname: `/app/live/${program.id}/register` } }}
                  className={`${registerCtaClass} bg-gray-900 text-white hover:bg-black`}
                >
                  Sign in to register
                </Link>
              ) : needsRegistrationWizard && !enrolled ? (
                <Link
                  to={`/app/live/${program.id}/register`}
                  className={`${registerCtaClass} bg-brand-600 text-white hover:bg-brand-700`}
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
                      : 'bg-brand-600 text-white hover:bg-brand-700',
                  ].join(' ')}
                >
                  {ctaLabel}
                </button>
              )
            ) : null}

            {!enrolled && myRegistration?.status !== 'PENDING' && needsRegistrationWizard ? (
              <p className="text-pretty text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                Complete registration here. Post-event surveys appear on the Surveys tab after the live session.
              </p>
            ) : null}
            {!enrolled && myRegistration?.status !== 'PENDING' && !needsRegistrationWizard ? (
              <p className="text-pretty text-[11px] text-muted-foreground sm:text-xs">
                Register to unlock video playback and earn rewards.
              </p>
            ) : null}
            {enrolled ? (
              <p className="text-pretty text-[11px] text-muted-foreground sm:text-xs">
                Complete required steps to earn rewards.
              </p>
            ) : null}

            {pendingRegistrationMessage ? (
              <div className="mt-auto w-full max-w-xl pt-1">
                <p className="text-pretty rounded-[6px] border border-warning/25 bg-warning/10 px-3 py-2 text-xs font-medium text-amber-900 sm:text-sm">
                  {pendingRegistrationMessage}
                </p>
              </div>
            ) : null}
            </div>

            {/* Session cover: right rail, stretches with card height */}
            <div className="flex w-[6.5rem] shrink-0 self-stretch min-[400px]:w-[7.25rem] min-[480px]:w-[8.5rem] sm:w-36 md:w-[11.5rem]">
              <div className="relative min-h-[8rem] w-full flex-1 overflow-hidden rounded-card border border-gray-200 bg-gradient-to-br from-sky-100/90 via-zinc-50 to-teal-100/70 shadow-card">
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
        <section className="bg-card border border-border rounded-card p-6 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Live webinar</h2>

          {registrationPendingApproval && !enrolled ? (
            <div className="rounded-card border border-warning/25 bg-warning/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-amber-400 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Registration submitted, pending approval</p>
                  <p className="mt-0.5 text-sm text-warning">
                    Your request has been received. An administrator will review it shortly. Your join link will activate here automatically after approval, when the live session opens.
                  </p>
                </div>
              </div>
            </div>
          ) : myRegistration?.status === 'SURVEY_SUBMITTED' && !enrolled ? (
            <div className="rounded-card border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-sky-400 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-sky-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-sky-900">Survey submitted</p>
                  <p className="mt-0.5 text-sm text-sky-800">
                    Your intake survey was received. Finish registration on the Register page so an administrator can approve you.
                  </p>
                </div>
              </div>
            </div>
          ) : enrolled ? (
            <div className="rounded-card border border-success/25 bg-success/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 shrink-0 text-green-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-semibold text-green-900">
                  You&apos;re registered and approved.{' '}
                  {program.canJoinSession
                    ? 'Use Join session below.'
                    : program.joinSessionOpensAt
                      ? `Join opens ${new Date(program.joinSessionOpensAt).toLocaleString()}.`
                      : 'Join opens closer to the live session.'}
                </p>
              </div>
            </div>
          ) : null}
          {program.zoomJoinUrl?.trim() && program.canJoinSession !== false && enrolled ? (
            <div className="flex flex-wrap gap-2">
              <Link
                to={`/app/live/${program.id}/session?returnTo=${encodeURIComponent(`/app/live/${program.id}`)}`}
                className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-gray-900 bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <MonitorPlay className="h-4 w-4" />
                Join in browser
              </Link>
              <a
                href={program.zoomJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Open in Zoom
                <ExternalLink className="h-4 w-4 opacity-80" />
              </a>
            </div>
          ) : enrolled ? (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-[6px] border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground"
              title={
                program.joinSessionReason ||
                (program.joinSessionOpensAt
                  ? `Join opens ${new Date(program.joinSessionOpensAt).toLocaleString()}`
                  : 'Join opens closer to the live session.')
              }
            >
              <Video className="h-4 w-4" />
              {program.joinSessionOpensAt
                ? `Join opens ${new Date(program.joinSessionOpensAt).toLocaleString()}`
                : 'Join session'}
              <ExternalLink className="h-4 w-4 opacity-60" />
            </button>
          ) : program.zoomJoinUrl?.trim() || program.joinSessionOpensAt ? (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-[6px] border border-border bg-muted px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                title="Available after an administrator approves your registration, when the live session opens."
              >
                <Video className="h-4 w-4" />
                Join session
                <ExternalLink className="h-4 w-4 opacity-60" />
              </button>
          ) : (
            <p className="text-sm text-amber-900 bg-warning/10 border border-warning/25 rounded-[6px] px-3 py-2">
              A join link is not available yet. If this persists, contact support so an admin can confirm the Zoom
              webinar is linked to this program.
            </p>
          )}
          {isAdmin &&
          (program.zoomSessionType === 'WEBINAR' ||
            program.zoomSessionType === 'MEETING') ? (
            <div className="rounded-[6px] border border-violet-200 bg-violet-50 px-3 py-3 space-y-2">
              <p className="text-xs font-semibold text-violet-900">Admin: start as Zoom host</p>
              <p className="text-xs text-violet-800">
                Learners use <strong>Join in browser</strong> above. Start the session here so they can join.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/app/live/${program.id}/session?host=1&returnTo=${encodeURIComponent(`/app/live/${program.id}`)}`}
                  className="inline-flex w-fit items-center justify-center gap-2 rounded-[6px] border border-violet-300 bg-white px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-100"
                >
                  <MonitorPlay className="h-4 w-4" />
                  Start as host in browser
                </Link>
                {program.zoomStartUrl?.trim() ? (
                  <a
                    href={program.zoomStartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center justify-center gap-2 rounded-[6px] border border-violet-200 bg-violet-100/50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100"
                  >
                    <Video className="h-4 w-4" />
                    Open host start link
                    <ExternalLink className="h-4 w-4 opacity-90" />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {enrolled && program.honorariumAmount ? (
        <section className="bg-card border border-border rounded-card p-6 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Payments and honorarium</h2>
          <p className="text-sm text-muted-foreground">
            Complete your <strong>W-9</strong> and payout profile under Payments so admins can send your honorarium after
            you finish the activity.
          </p>
          <Link
            to="/app/payments"
            className="inline-flex rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open Payments
          </Link>
        </section>
      ) : null}

      <section className="max-w-2xl">
        <div className="bg-card border border-border rounded-card p-6">
          <p className="text-xs font-semibold text-muted-foreground">Requirements</p>

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
            <div className="mt-5 rounded-[6px] border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">Register to unlock content and survey completion.</p>
            </div>
          ) : null}
          {!enrolled && registrationPendingApproval ? (
            <div className="mt-5 rounded-[6px] border border-warning/25 bg-warning/10 p-3">
              <p className="text-xs text-amber-900">
                You&apos;re registered, waiting for admin approval. Conversations and surveys unlock after approval.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {program && userId ? (
        <PostEventParticipantFlow
          program={program}
          userId={userId}
          userSummary={{
            firstName: user?.firstName,
            lastName: user?.lastName,
            email: user?.email,
          }}
          enrolled={enrolled}
          myRegistration={myRegistration}
          onPostEventNavLockChange={setPostEventNavLock}
        />
      ) : null}

      {enrolled &&
      wantsPostEventExtras &&
      !isPostEventSurveyUnlocked(program) &&
      program.zoomSessionType === 'WEBINAR' ? (
        <section className="rounded-card border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Post-event steps</p>
          <p className="mt-1">These unlock after the live session ends (or once attendance is verified, if required).</p>
        </section>
      ) : null}

      {/* Sticky CTA (mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card p-3">
        <div className="mx-auto max-w-7xl px-2 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{program.title}</p>
            <p className="text-xs text-muted-foreground truncate">
              {program.honorariumAmount ? `${formatMoney(program.honorariumAmount)} honorarium` : 'Honorarium available'} •{' '}
              {program.creditAmount > 0 ? `${program.creditAmount} CME` : 'Live session'}
            </p>
          </div>

          {myRegistration?.status === 'PENDING' ? (
            <span className="ml-auto text-xs font-medium text-warning">Pending approval</span>
          ) : registrationClosed && !enrolled ? (
            <span className="ml-auto text-xs font-medium text-muted-foreground">Registration closed</span>
          ) : needsRegistrationWizard && !enrolled && !userId ? (
            <Link
              to="/login"
              state={{ from: { pathname: `/app/live/${program.id}/register` } }}
              className="ml-auto shrink-0 rounded-[6px] px-4 py-2 text-sm font-semibold bg-gray-900 text-white"
            >
              Sign in
            </Link>
          ) : needsRegistrationWizard && !enrolled ? (
            <Link
              to={`/app/live/${program.id}/register`}
              className="ml-auto shrink-0 rounded-[6px] bg-brand-600 px-[26px] py-2 text-sm font-semibold text-white min-w-[172px] text-center"
            >
              Register
            </Link>
          ) : (
            <button
              onClick={() => enrollMutation.mutate({ programId: program.id })}
              disabled={ctaDisabled}
              className={[
                'ml-auto shrink-0 rounded-[6px] px-4 py-2 text-sm font-semibold',
                ctaDisabled
                  ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                  : 'bg-brand-600 text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]',
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
        <span className="text-xs font-semibold text-success bg-success/10 border border-success/25 rounded-[6px] px-2 py-1">
          Done
        </span>
      ) : inProgress ? (
        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-[6px] px-2 py-1">
          In progress
        </span>
      ) : pendingApproval ? (
        <span className="text-xs font-semibold text-warning bg-warning/10 border border-warning/25 rounded-[6px] px-2 py-1">
          Pending approval
        </span>
      ) : locked ? (
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-[6px] px-2 py-1">
          Locked
        </span>
      ) : (
        <span className="text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded-[6px] px-2 py-1">
          Pending
        </span>
      )}
    </li>
  );
}
