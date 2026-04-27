import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { isAxiosError } from 'axios';
import { surveysApi } from '../api/surveys';
import { getApiErrorMessage } from '../api/client';
import type { Survey } from '../api/surveys';
import { programsApi } from '../api/programs';
import {
  PostEventAttendanceMessage,
  PostEventFeedbackLearnerActions,
} from '../components/programs/PostEventFeedbackLearnerActions';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

function typeLabel(type?: Survey['type']) {
  if (!type) return 'Survey';
  if (type === 'PRE_TEST') return 'Pre-test';
  if (type === 'POST_TEST') return 'Post-test';
  if (type === 'FEEDBACK') return 'Post-event';
  return 'Survey';
}

function formatHonorarium(cents?: number | null) {
  if (cents == null || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const [started, setStarted] = useState(false);

  const { data: survey, isLoading, isError, error } = useQuery({
    queryKey: ['survey', id],
    queryFn: () => surveysApi.getById(id!),
    enabled: Boolean(id && userId),
  });

  const isPostEventFeedback = survey?.type === 'FEEDBACK' && Boolean(survey.programId);

  const { data: programRegistration } = useQuery({
    queryKey: ['program', survey?.programId, 'registration'],
    queryFn: () => programsApi.getMyRegistration(survey!.programId),
    enabled: Boolean(userId && isPostEventFeedback && survey?.programId),
  });

  const registrationApproved = programRegistration?.status === 'APPROVED';
  const attendanceOkForPostEvent =
    programRegistration?.postEventAttendanceStatus === 'VERIFIED' ||
    programRegistration?.postEventAttendanceStatus === 'NOT_REQUIRED';

  const hasJotform = Boolean(survey?.jotformFormId);

  const { data: myResponse } = useQuery({
    queryKey: ['survey', id, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(id!),
    enabled: Boolean(id && userId && survey),
    refetchInterval: (q) => {
      if (!hasJotform || !started || q.state.data?.submitted) return false;
      return 4000;
    },
  });
  const surveySaved = Boolean(myResponse?.submitted);

  const { data: jotformResume } = useQuery({
    queryKey: ['survey', id, 'jotform-resume'],
    queryFn: () => surveysApi.getJotformResume(id!),
    enabled: Boolean(id && userId && survey && hasJotform && !surveySaved),
  });

  const baseUrl = survey
    ? survey.jotformFormUrl ??
      (survey.jotformFormId ? `https://communityhealthmedia.jotform.com/${survey.jotformFormId}` : null)
    : null;
  const jotformFormUrl = baseUrl;
  const jotformEmbedUrl = useMemo(() => {
    if (!baseUrl || !survey) return null;
    const q = new URLSearchParams();
    if (userId) q.set('user_id', userId);
    if (survey.programId) q.set('program_id', survey.programId);
    const sessionId = jotformResume?.sessionId?.trim();
    if (sessionId) q.set('session', sessionId);
    const join = baseUrl.includes('?') ? '&' : '?';
    const suffix = q.toString();
    return suffix ? `${baseUrl}${join}${suffix}` : baseUrl;
  }, [baseUrl, userId, survey, jotformResume?.sessionId]);

  useEffect(() => {
    const sid = searchParams.get('session') || searchParams.get('jotform_session');
    if (!sid?.trim() || !userId || !id || !survey?.jotformFormId) return;
    let cancelled = false;
    (async () => {
      try {
        await surveysApi.putJotformResume(id, sid.trim());
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['survey', id, 'jotform-resume'] });
          const next = new URLSearchParams(searchParams);
          next.delete('session');
          next.delete('jotform_session');
          setSearchParams(next, { replace: true });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, userId, id, survey?.jotformFormId, queryClient, setSearchParams]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      // UI-only placeholder submission payload (answers empty for now)
      return surveysApi.submitResponse(id!, {
        userId,
        answers: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', id, 'my-response'] });
      queryClient.invalidateQueries({ queryKey: ['survey', id, 'jotform-resume'] });
    },
  });

  if (!userId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Sign in to view this survey</p>
        <p className="mt-1 text-sm text-gray-600">You need to be signed in to open surveys on this platform.</p>
        <div className="mt-5">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  if (isError || !survey) {
    const forbidden = isAxiosError(error) && error.response?.status === 403;
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">
          {forbidden ? 'This survey is not available yet' : 'Survey not found'}
        </p>
        <p className="mt-1 text-sm text-gray-600">
          {forbidden
            ? getApiErrorMessage(
                error,
                'This post-event survey unlocks after an administrator verifies your attendance for the live session (and after the session window, when applicable).',
              )
            : 'Return to surveys and try again.'}
        </p>
        <div className="mt-5">
          <Link
            to={forbidden ? '/app/live' : '/app/surveys'}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
          >
            {forbidden ? 'Back to Live' : 'Back to surveys'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3">
        <Link to="/app/surveys" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
          <span className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to surveys
          </span>
        </Link>

        <span className="text-xs font-semibold text-gray-600 rounded-full border border-gray-200 bg-white px-3 py-1">
          {typeLabel(survey.type)} • {survey.required ? 'Required' : 'Optional'}
        </span>
      </div>

      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">{survey.title}</h1>
        <p className="text-sm text-gray-600 max-w-3xl">
          {survey.description || 'Complete this survey to contribute your perspective.'}
        </p>
        {survey.type === 'FEEDBACK' && formatHonorarium(survey.program?.honorariumAmount) ? (
          <p className="text-sm text-gray-600 max-w-3xl">
            Listed honorarium for this program:{' '}
            <strong>{formatHonorarium(survey.program?.honorariumAmount)}</strong>.
          </p>
        ) : null}
      </header>

      {/* Main */}
      <section className="grid gap-6 lg:grid-cols-12">
        {/* Left: content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Start / Embed */}
          <div className="rounded-3xl border border-gray-200 bg-white p-6">
            {!started ? (
              surveySaved && hasJotform ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    Your responses are saved. Thank you for completing this survey.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="inline-flex w-fit items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 active:scale-[0.96]"
                  >
                    Open embedded form
                  </button>
                </div>
              ) : surveySaved && !hasJotform ? (
                <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  Your responses are saved. Thank you for completing this survey.
                </p>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-gray-900">Ready to complete the survey?</p>
                  <button
                    type="button"
                    onClick={() => setStarted(true)}
                    className="inline-flex w-fit items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
                  >
                    Start survey <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              )
            ) : null}

            {started ? (
              <div>
                {hasJotform && jotformEmbedUrl ? (
                  <div className="space-y-4">
                    {surveySaved ? (
                      <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        Your responses are saved. Thank you for completing this survey.
                      </p>
                    ) : (
                      <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        After you submit the form below, this page will update automatically when we receive your
                        responses (usually within a few seconds). If your Jotform uses <strong>Save &amp; Continue</strong>,
                        your progress is stored for <strong>24 hours</strong> when you return through this app (same
                        account).
                      </p>
                    )}
                    <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                      <iframe
                        src={jotformEmbedUrl}
                        title={survey.title}
                        className="w-full border-0"
                        style={{ height: 720, minHeight: 720 }}
                        allow="clipboard-write; camera; microphone"
                      />
                    </div>
                    {jotformFormUrl ? (
                      <p className="text-sm text-gray-600">
                        If the survey doesn&apos;t load above (e.g. on localhost),{' '}
                        <a
                          href={jotformEmbedUrl || jotformFormUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-gray-900 underline hover:text-gray-700"
                        >
                          open the survey in a new tab
                        </a>
                        .
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
                    <p className="font-semibold text-gray-900">Native survey renderer (placeholder)</p>
                    <p className="mt-1 text-sm text-gray-600">
                      We’ll render questions natively once the question format is finalized.
                      For now, you can preview the questions below.
                    </p>

                    <div className="mt-5">
                      <button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending}
                        className={[
                          'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold',
                          submitMutation.isPending
                            ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                            : 'bg-gray-900 text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]',
                        ].join(' ')}
                      >
                        {submitMutation.isPending ? 'Submitting…' : 'Mark as completed (UI)'}
                        <CheckCircle2 className="ml-2 h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {isPostEventFeedback && survey.programId ? (
            <div className="space-y-4">
              <PostEventAttendanceMessage myRegistration={programRegistration} />
              {registrationApproved && attendanceOkForPostEvent ? (
                <div className="rounded-3xl border border-gray-200 bg-white p-6 space-y-3">
                  <h2 className="text-base font-semibold text-gray-900">Record your response and honorarium</h2>
                  <p className="text-sm text-gray-600">
                    After you submit the Jotform above, use <strong>Complete survey</strong> to lock in your response
                    {survey.program?.honorariumAmount && survey.program.honorariumAmount > 0
                      ? ', then confirm payout details and tap Continue to create your pending honorarium request'
                      : ''}
                    . Each step can only be submitted once.
                  </p>
                  <PostEventFeedbackLearnerActions
                    programId={survey.programId}
                    userId={userId}
                    myRegistration={programRegistration}
                    hasHonorarium={Boolean(survey.program?.honorariumAmount && survey.program.honorariumAmount > 0)}
                    surveyReadyForAck={started || surveySaved}
                    surveyDetailId={id}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Right: meta */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-sm font-semibold text-gray-900">Details</p>

            <div className="mt-4 space-y-3 text-sm">
              <Meta label="Type" value={typeLabel(survey.type)} />
              <Meta label="Required" value={survey.required ? 'Yes' : 'No'} />
              <Meta label="Program" value={survey.program?.title ?? survey.programId} />
            </div>

          </div>

          <div className="rounded-3xl border border-gray-200 bg-gray-900 p-6">
            <p className="text-sm font-semibold text-white">Need to earn rewards?</p>
            <p className="mt-2 text-sm text-gray-300">
              Rewards and tracking are available in the app experience.
            </p>
            <Link
              to="/app/home"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Go home
            </Link>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900 text-right break-all">{value}</span>
    </div>
  );
}

