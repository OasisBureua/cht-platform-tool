import type { ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { programsApi, type ProgramRegistrationState } from '../../api/programs';
import { PostEventPayoutStep } from './PostEventPayoutStep';

export function PostEventAttendanceMessage(props: {
  myRegistration: ProgramRegistrationState | null | undefined;
}) {
  const { myRegistration } = props;
  const att = myRegistration?.postEventAttendanceStatus;
  if (att === 'PENDING_VERIFICATION') {
    return (
      <section className="bg-card border border-border rounded-card p-6 space-y-2">
        <h2 className="text-base font-semibold text-foreground">Post-event steps</h2>
        <p className="text-sm text-muted-foreground">
          Your registration is approved. After the live session, attendance is recorded automatically when the
          email on your HCP account matches the email Zoom saw. The post-event survey unlocks once that happens.
        </p>
      </section>
    );
  }
  if (att === 'DENIED') {
    return (
      <section className="rounded-card border border-destructive/25 bg-destructive/10 p-6 space-y-2">
        <h2 className="text-base font-semibold text-red-900">Attendance not verified</h2>
        <p className="text-sm text-destructive">
          Your attendance could not be verified for this session. If you believe this is a mistake, contact support.
        </p>
      </section>
    );
  }
  return null;
}

/**
 * Post-event survey + optional honorarium confirmation (program page and Surveys tab).
 *
 * Survey answers stay on the form; Stripe payout is a separate last step before submit
 * (summary + Continue/Edit, or inline Connect setup). Nothing payment-related is saved as survey fields.
 */
export function PostEventFeedbackLearnerActions(props: {
  programId: string;
  userId: string;
  myRegistration: ProgramRegistrationState | null | undefined;
  hasHonorarium: boolean;
  /** True when the learner has opened the embed or we already have a Jotform submission on file. */
  surveyReadyForAck: boolean;
  /** When set, invalidates this survey detail query after acknowledge (Surveys tab). */
  surveyDetailId?: string;
  /** Jotform flows need a separate acknowledge step after embed submit. */
  manualSurveyAckRequired?: boolean;
  /** Native in-app survey: parent owns form submit (draft or final). */
  nativeSurveyMode?: boolean;
  surveyFormSubmitting?: boolean;
  surveySubmitError?: string | null;
  onCompleteSurveyNative?: () => void;
  /** e.g. program page: render the survey form between help text and the Continue button. */
  betweenAckHelpAndButton?: ReactNode;
  /** Program page: advance wizard after draft/ack (e.g. to payout). */
  onSurveyAcknowledged?: (opts: { hasHonorarium: boolean }) => void;
  /** Program page: advance to final step after honorarium request is created. */
  onHonorariumRequestSubmitted?: () => void;
  /**
   * When true, only render the payout / final-submit step (survey already draft-saved).
   */
  payoutStepOnly?: boolean;
  /** Native feedback survey id — required to finalize a draft on the last click. */
  feedbackSurveyId?: string;
  /** @deprecated Kept for call-site compatibility; payout setup is inline now. */
  paymentsReturnTo?: string;
  /** @deprecated Payout readiness is loaded inside the payout step. */
  payoutReadyOverride?: boolean | null;
}) {
  const {
    programId,
    userId,
    myRegistration,
    hasHonorarium,
    surveyReadyForAck,
    manualSurveyAckRequired = true,
    nativeSurveyMode = false,
    surveyFormSubmitting = false,
    surveySubmitError,
    onCompleteSurveyNative,
    surveyDetailId,
    betweenAckHelpAndButton,
    onSurveyAcknowledged,
    onHonorariumRequestSubmitted,
    payoutStepOnly = false,
    feedbackSurveyId,
  } = props;
  const queryClient = useQueryClient();

  const approved = myRegistration?.status === 'APPROVED';
  const att = myRegistration?.postEventAttendanceStatus;
  const attendanceOk = att === 'VERIFIED' || att === 'NOT_REQUIRED';

  const surveyAcked = !!myRegistration?.postEventSurveyAcknowledgedAt;
  const honorariumDone = !!(myRegistration?.honorariumRequestedAt || myRegistration?.honorariumPayment);

  const showPayoutBlock =
    (payoutStepOnly || surveyAcked) &&
    hasHonorarium &&
    attendanceOk &&
    approved;
  const showDoneBlock =
    surveyAcked && (!hasHonorarium || honorariumDone) && attendanceOk && approved;
  const showAckBlock =
    !payoutStepOnly &&
    !surveyAcked &&
    attendanceOk &&
    approved &&
    (manualSurveyAckRequired || nativeSurveyMode);

  const invalidateAfterSurvey = () => {
    queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
    queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
    queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
    queryClient.invalidateQueries({ queryKey: ['surveys'] });
    if (surveyDetailId) {
      queryClient.invalidateQueries({ queryKey: ['survey', surveyDetailId] });
      queryClient.invalidateQueries({ queryKey: ['survey', surveyDetailId, 'my-response'] });
    }
    if (feedbackSurveyId) {
      queryClient.invalidateQueries({ queryKey: ['survey', feedbackSurveyId, 'my-response'] });
    }
  };

  const ackMut = useMutation({
    mutationFn: () => programsApi.acknowledgePostEventSurvey(programId),
    onSuccess: () => {
      invalidateAfterSurvey();
      onSurveyAcknowledged?.({ hasHonorarium });
    },
  });

  const completeSurveyDisabled = nativeSurveyMode
    ? surveyFormSubmitting || ackMut.isPending || surveyAcked || ackMut.isSuccess
    : !surveyReadyForAck ||
      ackMut.isPending ||
      !!myRegistration?.postEventSurveyAcknowledgedAt ||
      ackMut.isSuccess;

  const handleCompleteSurvey = () => {
    if (nativeSurveyMode) {
      onCompleteSurveyNative?.();
      return;
    }
    ackMut.mutateAsync().catch(() => {});
  };

  if (!myRegistration || !approved) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showAckBlock ? (
        <div className="space-y-3">
          {nativeSurveyMode ? (
            <p className="text-sm text-muted-foreground">
              Complete the survey below, then tap <strong>Continue</strong> to save your answers
              {hasHonorarium
                ? '. Next you will confirm payout details (or set them up inline) before submitting.'
                : '.'}
            </p>
          ) : surveyReadyForAck ? (
            <p className="text-sm text-muted-foreground">
              {betweenAckHelpAndButton ? (
                <>
                  Submit the embedded survey, then tap <strong>Complete survey</strong> to record your response
                  {hasHonorarium ? ' before continuing to payout' : ''}.
                </>
              ) : (
                <>
                  Your survey answers were saved. Tap <strong>Complete survey</strong> to finish this step
                  {hasHonorarium ? ' before continuing to payout' : ''}.
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {betweenAckHelpAndButton ? (
                <>
                  Complete the survey below, then tap <strong>Complete survey</strong>
                  {hasHonorarium ? ' before confirming your honorarium' : ''}.
                </>
              ) : (
                <>
                  Open and complete the post-event survey, then return here and tap <strong>Complete survey</strong>
                  {hasHonorarium ? ' before confirming your honorarium' : ''}.
                </>
              )}
            </p>
          )}
          {betweenAckHelpAndButton}
          {surveySubmitError ? (
            <p className="text-sm text-destructive">{surveySubmitError}</p>
          ) : null}
          <button
            type="button"
            disabled={completeSurveyDisabled}
            onClick={handleCompleteSurvey}
            className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {nativeSurveyMode && surveyFormSubmitting
              ? 'Saving…'
              : ackMut.isPending
                ? 'Saving…'
                : myRegistration.postEventSurveyAcknowledgedAt || ackMut.isSuccess
                  ? 'Survey recorded'
                  : nativeSurveyMode
                    ? 'Continue'
                    : 'Complete survey'}
          </button>
          {!nativeSurveyMode && ackMut.isError ? (
            <p className="text-sm text-destructive">Could not save progress. Check your connection and try again.</p>
          ) : null}
        </div>
      ) : null}

      {showPayoutBlock ? (
        <PostEventPayoutStep
          programId={programId}
          userId={userId}
          myRegistration={myRegistration}
          feedbackSurveyId={feedbackSurveyId}
          nativeSurveyMode={nativeSurveyMode}
          onSubmitted={onHonorariumRequestSubmitted}
        />
      ) : null}

      {showDoneBlock && !showPayoutBlock ? (
        <div className="space-y-2">
          {hasHonorarium ? (
            <>
              <p className="text-sm text-muted-foreground">
                {myRegistration.honorariumPayment?.status === 'PAID' ? (
                  <>Your honorarium has been marked paid.</>
                ) : (
                  <>
                    A <strong>pending</strong> honorarium is on file. An administrator will review and use{' '}
                    <strong>Pay now</strong> in the admin tools when ready; you will see the status under Payments when it
                    is sent.
                  </>
                )}
              </p>
              <Link to="/app/payments" className="inline-flex text-sm font-semibold text-foreground underline">
                Open Payments
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Thank you. Your post-event survey response is recorded.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
