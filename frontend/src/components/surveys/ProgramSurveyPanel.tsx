import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../ui/LoadingSpinner';
import { surveysApi } from '../../api/surveys';
import { dashboardApi } from '../../api/dashboard';
import { NativeSurveyForm } from './NativeSurveyForm';
import { UpdateSavedDetailsPrompt } from './UpdateSavedDetailsPrompt';
import { surveyHasNativeQuestions } from '../../utils/survey-questions';
import { getApiErrorMessage } from '../../api/client';

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
  /** Save answers without completing the survey (post-event payout handoff). */
  submitAsDraft?: boolean;
  onSubmittingChange?: (submitting: boolean) => void;
  onSubmitError?: () => void;
  onSubmitted?: (submissionId: string, meta?: { draft?: boolean }) => void;
};

type PendingSubmit = {
  submissionId: string;
  draft: boolean;
  suggestedProfileUpdates: Record<string, string>;
};

/**
 * Renders the program's native survey form.
 * Identity is never passed via URL query params (session-bound native submit).
 * Prefills from the signed-in user's profile; profile write-back is opt-in only.
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
  submitAsDraft = false,
  onSubmittingChange,
  onSubmitError,
  onSubmitted,
}: Props) {
  const queryClient = useQueryClient();
  const onSubmittedRef = useRef(onSubmitted);
  useEffect(() => {
    onSubmittedRef.current = onSubmitted;
  }, [onSubmitted]);

  const [pendingSubmit, setPendingSubmit] = useState<PendingSubmit | null>(null);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  const finishSubmit = (submissionId: string, draft: boolean) => {
    setPendingSubmit(null);
    setProfileSaveError(null);
    setLocalSubmitted(!draft);
    onSubmittedRef.current?.(submissionId, { draft });
  };

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

  const { data: profilePrefill } = useQuery({
    queryKey: ['survey', surveyId, 'profile-prefill'],
    queryFn: () => surveysApi.getProfilePrefill(surveyId),
    enabled: Boolean(surveyId && userId && authenticated),
  });

  const submitMut = useMutation({
    mutationFn: (answers: Record<string, unknown>) =>
      surveysApi.submitResponse(surveyId, {
        answers,
        ...(submitAsDraft ? { draft: true } : {}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['survey', surveyId, 'my-response'] });
      queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
      const submissionId = data.submissionId ?? data.id;
      const draft = !!data.draft;
      if (
        !draft &&
        data.suggestedProfileUpdates &&
        Object.keys(data.suggestedProfileUpdates).length > 0
      ) {
        setPendingSubmit({
          submissionId,
          draft,
          suggestedProfileUpdates: data.suggestedProfileUpdates,
        });
        setProfileSaveError(null);
        return;
      }
      finishSubmit(submissionId, draft);
    },
    onError: () => {
      onSubmittingChange?.(false);
      onSubmitError?.();
    },
  });

  const saveProfileMut = useMutation({
    mutationFn: (updates: Record<string, string>) =>
      dashboardApi.updateProfile(userId, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['survey', surveyId, 'profile-prefill'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', userId, 'profile'] });
      if (pendingSubmit) {
        finishSubmit(pendingSubmit.submissionId, pendingSubmit.draft);
      }
    },
    onError: (err: unknown) => {
      setProfileSaveError(
        getApiErrorMessage(err, 'Could not update your saved details.'),
      );
    },
  });

  useEffect(() => {
    onSubmittingChange?.(submitMut.isPending || saveProfileMut.isPending);
    return () => onSubmittingChange?.(false);
  }, [submitMut.isPending, saveProfileMut.isPending, onSubmittingChange]);

  if (isLoading || !survey) {
    return (
      <div className="py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const alreadySubmitted =
    localSubmitted || (!!myResponse?.submitted && !pendingSubmit);

  if (alreadySubmitted) {
    return (
      <p className="text-sm font-medium text-success bg-success/10 border border-success/25 rounded-card px-4 py-3">
        Your survey responses are saved.
      </p>
    );
  }

  if (!surveyHasNativeQuestions(survey.questions)) {
    return (
      <p className="text-sm text-muted-foreground">
        No survey form is configured for this program yet.
      </p>
    );
  }

  return (
    <>
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
        showPayoutNotice={survey.type === 'FEEDBACK' && !submitAsDraft}
        profilePrefill={profilePrefill}
        initialAnswers={myResponse?.draft ? myResponse.answers : undefined}
        onSubmit={(answers) => submitMut.mutate(answers)}
      />

      {pendingSubmit ? (
        <UpdateSavedDetailsPrompt
          updates={pendingSubmit.suggestedProfileUpdates}
          saving={saveProfileMut.isPending}
          error={profileSaveError}
          onConfirm={() =>
            saveProfileMut.mutate(pendingSubmit.suggestedProfileUpdates)
          }
          onSkip={() =>
            finishSubmit(pendingSubmit.submissionId, pendingSubmit.draft)
          }
        />
      ) : null}
    </>
  );
}
