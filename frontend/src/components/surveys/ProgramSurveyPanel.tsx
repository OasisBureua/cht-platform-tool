import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../ui/LoadingSpinner';
import { surveysApi } from '../../api/surveys';
import { NativeSurveyForm } from './NativeSurveyForm';
import { surveyHasNativeQuestions } from '../../utils/survey-questions';

type Props = {
  surveyId: string;
  userId: string;
  programId: string;
  /** @deprecated Ignored: registration/feedback panels are native-only. */
  legacyJotformUrl?: string;
  /** @deprecated Ignored: Jotform embeds are no longer used. */
  feedbackUsesJotform?: boolean;
  authenticated: boolean;
  userSummary?: { firstName?: string; lastName?: string; email?: string };
  submitLabel?: string;
  hideSubmitButton?: boolean;
  formId?: string;
  onSubmittingChange?: (submitting: boolean) => void;
  onSubmitError?: () => void;
  onSubmitted?: (submissionId: string) => void;
};

/**
 * Renders the program's native survey form.
 * Identity is never passed via URL query params (session-bound native submit).
 */
export function ProgramSurveyPanel({
  surveyId,
  userId,
  programId,
  authenticated,
  userSummary,
  submitLabel,
  hideSubmitButton,
  formId,
  onSubmittingChange,
  onSubmitError,
  onSubmitted,
}: Props) {
  const queryClient = useQueryClient();
  const { data: survey, isLoading } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => surveysApi.getById(surveyId),
    enabled: Boolean(surveyId && userId),
  });

  const { data: myResponse } = useQuery({
    queryKey: ['survey', surveyId, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(surveyId),
    enabled: Boolean(surveyId && userId),
  });

  const submitMut = useMutation({
    mutationFn: (answers: Record<string, unknown>) =>
      surveysApi.submitResponse(surveyId, { answers }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', surveyId, 'my-response'] });
      queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
      onSubmitted?.(data.submissionId ?? data.id);
    },
    onError: () => {
      onSubmittingChange?.(false);
      onSubmitError?.();
    },
  });

  useEffect(() => {
    onSubmittingChange?.(submitMut.isPending);
    return () => onSubmittingChange?.(false);
  }, [submitMut.isPending, onSubmittingChange]);

  if (isLoading || !survey) {
    return (
      <div className="py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (myResponse?.submitted) {
    return (
      <p className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
        Your survey responses are saved.
      </p>
    );
  }

  if (!surveyHasNativeQuestions(survey.questions)) {
    return (
      <p className="text-sm text-gray-600">
        No survey form is configured for this program yet.
      </p>
    );
  }

  return (
    <NativeSurveyForm
      surveyId={survey.id}
      title={survey.title}
      questions={survey.questions}
      authenticated={authenticated}
      userSummary={userSummary}
      submitting={submitMut.isPending}
      submitLabel={submitLabel}
      hideSubmitButton={hideSubmitButton}
      formId={formId}
      showPayoutNotice={survey.type === 'FEEDBACK'}
      onSubmit={(answers) => submitMut.mutate(answers)}
    />
  );
}
