import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { NativeSurveyForm } from '../components/surveys/NativeSurveyForm';
import { surveyHasNativeQuestions } from '../utils/survey-questions';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const SURVEY_DETAIL_NATIVE_FORM_ID = 'survey-detail-native-form';

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.userId ?? '';

  const [started, setStarted] = useState(false);
  const [nativeSurveyError, setNativeSurveyError] = useState<string | null>(null);

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

  const useNativeRenderer = Boolean(survey && surveyHasNativeQuestions(survey.questions));

  const { data: myResponse } = useQuery({
    queryKey: ['survey', id, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(id!),
    enabled: Boolean(id && userId && survey),
  });
  const surveySaved = Boolean(myResponse?.submitted);
  const surveyAcked = isPostEventFeedback && !!programRegistration?.postEventSurveyAcknowledgedAt;
  // For FEEDBACK surveys, once acknowledged the form is permanently locked, no resubmission.
  const formLocked = surveyAcked;

  const submitMutation = useMutation({
    mutationFn: async (answers: Record<string, unknown>) =>
      surveysApi.submitResponse(id!, { answers }),
    onSuccess: () => {
      setNativeSurveyError(null);
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', id, 'my-response'] });
      if (survey?.programId) {
        queryClient.invalidateQueries({ queryKey: ['program', survey.programId, 'registration'] });
      }
    },
    onError: () => {
      setNativeSurveyError('Could not save survey. Check your connection and try again.');
    },
  });

  const handleCompleteNativeSurvey = () => {
    setNativeSurveyError(null);
    if (surveySaved || surveyAcked) return;
    const form = document.getElementById(SURVEY_DETAIL_NATIVE_FORM_ID) as HTMLFormElement | null;
    if (!form) return;
    if (!form.reportValidity()) {
      setNativeSurveyError('Complete all required fields before tapping Complete survey.');
      return;
    }
    // Gate: NativeSurveyForm ignores Enter/implicit submits unless this flag is set.
    form.dataset.chtExplicitSubmit = '1';
    form.requestSubmit();
  };

  if (!userId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
        <p className="font-semibold text-gray-900">Sign in to view this survey</p>
        <p className="mt-1 text-sm text-gray-600">You need to be signed in to open surveys on this platform.</p>
        <div className="mt-5">
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
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
            {formLocked || surveySaved ? (
              <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                {formLocked || isPostEventFeedback
                  ? 'Your post-event survey response has been recorded. This survey can no longer be resubmitted.'
                  : 'Your responses are saved. Thank you for completing this survey.'}
              </p>
            ) : !started ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-gray-900">Ready to complete the survey?</p>
                <button
                  type="button"
                  onClick={() => setStarted(true)}
                  className="inline-flex w-fit items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
                >
                  Start survey <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </div>
            ) : useNativeRenderer ? (
              <NativeSurveyForm
                surveyId={survey.id}
                title={survey.title}
                questions={survey.questions}
                authenticated={!!userId}
                userSummary={{
                  firstName: user?.firstName,
                  lastName: user?.lastName,
                  email: user?.email,
                }}
                disabled={submitMutation.isPending}
                submitting={submitMutation.isPending}
                hideSubmitButton={isPostEventFeedback}
                formId={isPostEventFeedback ? SURVEY_DETAIL_NATIVE_FORM_ID : undefined}
                showPayoutNotice={isPostEventFeedback}
                onSubmit={(answers) => submitMutation.mutate(answers)}
              />
            ) : (
              <p className="text-sm text-gray-600">
                This survey is not available yet. Contact support if you need assistance.
              </p>
            )}
          </div>

          {isPostEventFeedback && survey.programId ? (
            <div className="space-y-4">
              <PostEventAttendanceMessage myRegistration={programRegistration} />
              {registrationApproved && attendanceOkForPostEvent ? (
                <div className="rounded-3xl border border-gray-200 bg-white p-6 space-y-3">
                  <h2 className="text-base font-semibold text-gray-900">Record your response and honorarium</h2>
                  <PostEventFeedbackLearnerActions
                    programId={survey.programId}
                    userId={userId}
                    myRegistration={programRegistration}
                    hasHonorarium={Boolean(survey.program?.honorariumAmount && survey.program.honorariumAmount > 0)}
                    surveyReadyForAck={surveySaved && !useNativeRenderer}
                    nativeSurveyMode={isPostEventFeedback && useNativeRenderer}
                    surveyFormSubmitting={submitMutation.isPending}
                    surveySubmitError={nativeSurveyError}
                    onCompleteSurveyNative={handleCompleteNativeSurvey}
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

          <div className="rounded-3xl border border-gray-200 bg-brand-950 p-6">
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

