import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { programsApi } from '../api/programs';
import { webinarsApi } from '../api/webinars';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  Award,
  DollarSign,
  ChevronLeft,
  Play,
  Lock,
  CheckCircle2,
  Circle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';

function formatMoney(value?: number | null) {
  if (!value) return '$0';
  return `$${value.toLocaleString()}`;
}

function formatDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}

export default function WebinarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const isZoomWebinar = id?.startsWith('zoom-') ?? false;

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

  const { data: enrollments } = useQuery({
    queryKey: ['enrollments', userId],
    queryFn: () => programsApi.getEnrollments(userId),
    enabled: !!userId,
  });

  const enrolledProgramIds = useMemo(
    () => new Set(enrollments?.map((e) => e.programId) || []),
    [enrollments]
  );

  const enrollMutation = useMutation({
    mutationFn: ({ programId }: { programId: string }) =>
      programsApi.enroll(userId, programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', userId] });
    },
  });

  if (isZoomWebinar) {
    if (zoomLoading) return <LoadingSpinner />;
    if (!zoomWebinar) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
          <p className="font-semibold text-gray-900">Webinar not found</p>
          <Link to="/app/webinars" className="mt-5 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
            Back to webinars
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
          Back to Webinars
        </button>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-2xl font-bold text-gray-900">{zoomWebinar.title}</h1>
          <p className="mt-3 text-gray-600">{zoomWebinar.description}</p>
          {zoomWebinar.joinUrl && (
            <a
              href={zoomWebinar.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Join Webinar
            </a>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">We couldn’t load this webinar.</p>
        <p className="mt-1 text-sm text-gray-600">
          {String((error as any)?.message || 'Please try again.')}
        </p>
        <div className="mt-5">
          <Link
            to="/app/webinars"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to webinars
          </Link>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Webinar not found</p>
        <p className="mt-1 text-sm text-gray-600">That link may be invalid.</p>
        <div className="mt-5">
          <Link
            to="/app/webinars"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Back to webinars
          </Link>
        </div>
      </div>
    );
  }

  const enrolled = enrolledProgramIds.has(program.id);
  const hasVideos = (program.videos?.length || 0) > 0;
  const firstVideo = hasVideos
    ? program.videos.slice().sort((a, b) => a.order - b.order)[0]
    : null;

  const ctaLabel = enrolled
    ? 'Registered'
    : enrollMutation.isPending
    ? 'Registering…'
    : 'Register Now';

  const ctaDisabled = enrolled || enrollMutation.isPending;

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {/* Back */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Webinars
        </button>
      </div>

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
                Webinar
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
          <div className="hidden md:block md:pt-1">
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

            {!enrolled ? (
              <p className="mt-2 text-xs text-gray-600">
                Register to unlock video playback and earn rewards.
              </p>
            ) : (
              <p className="mt-2 text-xs text-gray-600">
                Complete required steps to earn rewards.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stepper + Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Stepper */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900">How this works</h2>
            <p className="mt-1 text-sm text-gray-600">
              Complete the steps below to unlock CME credit and rewards.
            </p>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
              <StepCard
                title="Register"
                subtitle="Join the activity"
                done={enrolled}
                active={!enrolled}
              />
              <StepCard
                title="Conversations"
                subtitle={hasVideos ? `${program.videos.length} video(s)` : 'Video coming soon'}
                done={false}
                active={enrolled}
                disabled={!enrolled}
              />
              <StepCard
                title="Survey"
                subtitle="Required questionnaire"
                done={false}
                active={enrolled}
                disabled={!enrolled}
              />
              <StepCard
                title="Earn"
                subtitle="Get paid + credits"
                done={false}
                active={enrolled}
                disabled={!enrolled}
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                to="/app/surveys"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ClipboardList className="h-4 w-4" />
                View Surveys
              </Link>

              {enrolled && firstVideo ? (
                <button
                  onClick={() => navigate(`/app/watch/${firstVideo.id}`)}
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Continue in Conversations
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Program Videos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Program Videos</h2>
              <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
                View all
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="divide-y divide-gray-200">
                {hasVideos ? (
                  program.videos
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((video) => {
                      const disabled = !enrolled;
                      const meta =
                        video.description ||
                        `${formatDuration(video.duration)} • ${video.platform}`;

                      return (
                        <div
                          key={video.id}
                          className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {video.title}
                            </p>
                            <p className="text-sm text-gray-600 truncate">{meta}</p>
                          </div>

                          <button
                            onClick={() => navigate(`/app/watch/${video.id}`)}
                            disabled={disabled}
                            className={[
                              'shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold border',
                              disabled
                                ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                            ].join(' ')}
                            title={disabled ? 'Register to unlock playback' : 'Conversations'}
                          >
                            {disabled ? (
                              <Lock className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                            {disabled ? 'Locked' : 'Conversations'}
                          </button>
                        </div>
                      );
                    })
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-sm font-semibold text-gray-900">No videos available</p>
                    <p className="mt-1 text-sm text-gray-600">
                      This program will be updated with videos soon.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          {/* What you'll earn */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-xs font-semibold text-gray-600">What you’ll earn</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              {program.honorariumAmount ? formatMoney(program.honorariumAmount) : '$0'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Honorarium for completion
            </p>

            <div className="mt-4 flex items-center gap-2 text-sm text-gray-700">
              <Award className="h-4 w-4" />
              <span className="font-semibold text-gray-900">{program.creditAmount}</span>{' '}
              CME credits
            </div>

            <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700">Tip</p>
              <p className="mt-1 text-xs text-gray-600">
                Rewards typically process after required steps are completed.
              </p>
            </div>
          </div>

          {/* Requirements */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-xs font-semibold text-gray-600">Requirements</p>

            <ul className="mt-4 space-y-3">
              <RequirementRow
                label="Register for the activity"
                done={enrolled}
              />
              <RequirementRow
                label="Complete all required videos in Conversations"
                done={false}
                disabled={!enrolled}
              />
              <RequirementRow
                label="Complete required survey"
                done={false}
                disabled={!enrolled}
              />
            </ul>

            {!enrolled ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-600">
                  Register to unlock content and survey completion.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

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
        </div>
      </div>
    </div>
  );
}

function StepCard(props: {
  title: string;
  subtitle: string;
  done?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  const { title, subtitle, done, active, disabled } = props;

  return (
    <div
      className={[
        'rounded-xl border p-4',
        disabled ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white',
        active ? 'ring-1 ring-gray-900/10' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-xs text-gray-600">{subtitle}</p>
        </div>
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className="h-5 w-5 text-gray-300" />
        )}
      </div>
    </div>
  );
}

function RequirementRow(props: { label: string; done?: boolean; disabled?: boolean }) {
  const { label, done, disabled } = props;

  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Circle className={['h-5 w-5', disabled ? 'text-gray-200' : 'text-gray-300'].join(' ')} />
        )}
        <span className={['text-sm truncate', disabled ? 'text-gray-400' : 'text-gray-700'].join(' ')}>
          {label}
        </span>
      </div>
      {done ? (
        <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
          Done
        </span>
      ) : disabled ? (
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
