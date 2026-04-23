import { useMemo, useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { programsApi } from '../api/programs';
import { buildPostEventSurveyEmbedSrc, isPostEventSurveyUnlocked } from '../utils/post-event-survey';
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
} from 'lucide-react';
import { buildProgramRegisterHref, readIntakeSubmissionIdFromSearch } from '../utils/intake-return';

function formatMoney(value?: number | null) {
  if (!value) return '$0';
  return `$${value.toLocaleString()}`;
}

export default function WebinarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const isZoomWebinar = id?.startsWith('zoom-') ?? false;
  const [postEventSurveyStep, setPostEventSurveyStep] = useState<0 | 1>(0);

  useEffect(() => {
    setPostEventSurveyStep(0);
  }, [id]);

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

  const { data: myRegistration } = useQuery({
    queryKey: ['program', id, 'registration'],
    queryFn: () => programsApi.getMyRegistration(id!),
    enabled: !!userId && !!id && !isZoomWebinar && !!program && program.zoomSessionType === 'WEBINAR',
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 4000 : false),
  });

  const pollWhileRegistrationPending = myRegistration?.status === 'PENDING';

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => programsApi.getEnrollments(userId),
    enabled: !!userId,
    refetchInterval: pollWhileRegistrationPending ? 4000 : false,
  });

  const enrolledProgramIds = useMemo(
    () => new Set(enrollments?.map((e) => e.programId) || []),
    [enrollments]
  );

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
          <Link to="/app/live" className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
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
          Back to LIVE
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">{zoomWebinar.title}</h1>
          <p className="mt-3 text-gray-600">{zoomWebinar.description}</p>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Use a scheduled LIVE webinar in the app</p>
            <p className="mt-1 text-amber-900">
              CME registration, admin approval, and honorarium payouts run through platform webinars. Raw Zoom-only
              listings do not support that workflow.
            </p>
          </div>
          {zoomWebinar.joinUrl ? (
            <p className="text-xs text-gray-600">
              If you were given a direct host or panel link:{' '}
              <a
                href={zoomWebinar.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-gray-900 underline"
              >
                Open in Zoom
              </a>
            </p>
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
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to LIVE
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
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to LIVE
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
  const surveyDone =
    enrolled &&
    (!hasPostEventSurvey || (postEventSurveyWindowOpen && !postEventReminder));

  const registrationPendingApproval = myRegistration?.status === 'PENDING';
  const showJoinSessionCard =
    program.zoomSessionType === 'WEBINAR' && (enrolled || registrationPendingApproval);

  /** LIVE webinars always use the registration wizard so intake (when configured) is not skipped via quick enroll. */
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

  const showPostEventSurvey =
    enrolled &&
    !!program.jotformSurveyUrl?.trim() &&
    !!userId &&
    isPostEventSurveyUnlocked(program);

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {/* Back */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to LIVE
        </button>
      </div>

      {program.zoomSessionType === 'WEBINAR' && postEventReminder && enrolled && showPostEventSurvey ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Post-event survey</p>
          <p className="mt-1 text-amber-900">
            Complete the post-event survey on the{' '}
            <Link to="/app/surveys" className="font-semibold underline">
              Surveys
            </Link>{' '}
            tab (or below on this page). Ensure <strong>Payments</strong> is up to date for honorarium processing. This
            also appears under the header notifications (bell) for enrolled participants.
          </p>
        </div>
      ) : null}

      {/* Header / Overview */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{program.title}</p>

            <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
              {program.description}
            </h1>

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
              {program.sponsorName && (
                <span className="font-medium">{program.sponsorName}</span>
              )}

              <span className="inline-flex items-center gap-1">
                <Award className="h-4 w-4" />
                {program.creditAmount} CME Credits
              </span>

              {program.honorariumAmount ? (
                <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                  <DollarSign className="h-4 w-4" />
                  {formatMoney(program.honorariumAmount)} honorarium
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                LIVE
              </span>

              <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                {program.status}
              </span>

              {program.accreditationBody ? (
                <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
                  {program.accreditationBody}
                </span>
              ) : null}
            </div>
          </div>

          {/* CTA (desktop) */}
          <div className="hidden md:block md:pt-1 space-y-2">
            {myRegistration?.status === 'PENDING' ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {myRegistration.intakeJotformSubmissionId
                    ? 'Your registration survey was received. Waiting for an administrator to approve you before you can join the webinar in the app.'
                    : 'Registration is pending. Complete the survey if you have not yet, then wait for approval.'}
                </p>
              </div>
            ) : needsRegistrationWizard && !enrolled && !userId ? (
              <Link
                to="/login"
                state={{ from: { pathname: `/app/live/${program.id}` } }}
                className="inline-flex w-full md:w-auto justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Sign in to register
              </Link>
            ) : needsRegistrationWizard && !enrolled ? (
              <Link
                to={`/app/live/${program.id}/register`}
                className="inline-flex w-full md:w-auto justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Register
              </Link>
            ) : (
              <button
                onClick={() => enrollMutation.mutate({ programId: program.id })}
                disabled={ctaDisabled}
                className={[
                  'w-full md:w-auto rounded-lg px-4 py-2 text-sm font-semibold',
                  ctaDisabled
                    ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                    : 'bg-gray-900 text-white hover:bg-black',
                ].join(' ')}
              >
                {ctaLabel}
              </button>
            )}

            {!enrolled && myRegistration?.status !== 'PENDING' && needsRegistrationWizard ? (
              <p className="mt-2 text-xs text-gray-600">
                Complete registration here. Post-event surveys appear on the Surveys tab after the live session.
              </p>
            ) : null}
            {!enrolled && myRegistration?.status !== 'PENDING' && !needsRegistrationWizard ? (
              <p className="mt-2 text-xs text-gray-600">Register to unlock video playback and earn rewards.</p>
            ) : null}
            {enrolled ? (
              <p className="mt-2 text-xs text-gray-600">Complete required steps to earn rewards.</p>
            ) : null}
          </div>
        </div>
      </section>

      {showJoinSessionCard ? (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-base font-semibold text-gray-900">Live webinar</h2>
          <p className="text-sm text-gray-600">
            {registrationPendingApproval && !enrolled ? (
              <>
                Your join link is shown below so you know what to expect. It stays inactive until an administrator
                approves your registration—then you can open Zoom as usual (browser or app).
              </>
            ) : (
              <>
                Use <strong>Join session</strong> to open Zoom the usual way (browser or Zoom app).
              </>
            )}
          </p>
          {program.zoomJoinUrl?.trim() ? (
            enrolled ? (
              <a
                href={program.zoomJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
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
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
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

      {showPostEventSurvey ? (
        <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Post-event survey</h2>
          {postEventSurveyStep === 0 ? (
            <>
              <p className="text-sm text-gray-600">
                Complete this survey after the live session. Responses are tied to your account for credit and honorarium
                follow-up. Tap <strong>Continue</strong> to open the survey—you won&apos;t be able to return to this step.
              </p>
              <button
                type="button"
                onClick={() => setPostEventSurveyStep(1)}
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Continue
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Submit the survey below, then go to <strong>Payments</strong> to confirm your W-9 and payment details.
              </p>
              <div className="min-h-[400px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                <iframe
                  title="Post-event survey"
                  src={buildPostEventSurveyEmbedSrc(program.jotformSurveyUrl!, userId, program.id)}
                  className="w-full h-[480px]"
                  allow="camera; microphone"
                />
              </div>
              <button
                type="button"
                onClick={() => navigate('/app/payments')}
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Continue to Payments
              </button>
            </>
          )}
        </section>
      ) : enrolled && program.jotformSurveyUrl?.trim() && program.zoomSessionType === 'WEBINAR' ? (
        <section className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Post-event survey</p>
          <p className="mt-1">
            The post-event survey will unlock here after the live session ends.
          </p>
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
              className="ml-auto shrink-0 rounded-lg px-4 py-2 text-sm font-semibold bg-gray-900 text-white"
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
                  : 'bg-gray-900 text-white hover:bg-black',
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
  /** No access until admin approves registration */
  locked?: boolean;
  /** Registration submitted; waiting on admin */
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
        <span className={['text-sm truncate', locked ? 'text-gray-400' : 'text-gray-700'].join(' ')}>
          {label}
        </span>
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
