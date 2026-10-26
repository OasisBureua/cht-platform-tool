import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { programsApi, type ProgramRegistrationState } from '../../api/programs';
import { surveysApi } from '../../api/surveys';
import { StripeMark } from '../branding/StripeMark';

function paymentsHref(returnTo?: string) {
  if (!returnTo) return '/app/payments';
  return `/app/payments?returnTo=${encodeURIComponent(returnTo)}`;
}

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
 * Connected Stripe: one CTA submits survey + payment request.
 * Not connected: draft-save → Payments setup (returnTo) → same final CTA.
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
   * Final CTA stamps survey complete + honorarium request together.
   */
  payoutStepOnly?: boolean;
  /** Native feedback survey id — required to finalize a draft on the last click. */
  feedbackSurveyId?: string;
  /** After payment setup, return here (e.g. `/app/live/:id`). */
  paymentsReturnTo?: string;
  /**
   * Optional override for payout readiness (parent may already have fetched preview).
   * When omitted, this component loads honorarium preview itself.
   */
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
    paymentsReturnTo,
    payoutReadyOverride = null,
  } = props;
  const queryClient = useQueryClient();
  const payLink = paymentsHref(paymentsReturnTo);

  const approved = myRegistration?.status === 'APPROVED';
  const att = myRegistration?.postEventAttendanceStatus;
  const attendanceOk = att === 'VERIFIED' || att === 'NOT_REQUIRED';

  const surveyAcked = !!myRegistration?.postEventSurveyAcknowledgedAt;
  const honorariumDone = !!(myRegistration?.honorariumRequestedAt || myRegistration?.honorariumPayment);

  const showPayoutBlock =
    (payoutStepOnly || surveyAcked) &&
    hasHonorarium &&
    !honorariumDone &&
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

  const needsPayoutPreview =
    hasHonorarium &&
    approved &&
    attendanceOk &&
    !honorariumDone &&
    (showAckBlock || showPayoutBlock);

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

  const finalizeMut = useMutation({
    mutationFn: async () => {
      if (feedbackSurveyId && !surveyAcked) {
        const mine = await surveysApi.getMyResponse(feedbackSurveyId);
        const answers = mine.answers ?? {};
        if (!mine.submitted) {
          await surveysApi.submitResponse(feedbackSurveyId, {
            answers,
            draft: false,
          });
        }
      } else if (!surveyAcked && !nativeSurveyMode) {
        await programsApi.acknowledgePostEventSurvey(programId);
      }
      return programsApi.requestPostEventHonorarium(programId);
    },
    onSuccess: () => {
      invalidateAfterSurvey();
      queryClient.invalidateQueries({ queryKey: ['programs', programId, 'honorarium-preview'] });
      onHonorariumRequestSubmitted?.();
    },
  });

  const payMut = useMutation({
    mutationFn: () => programsApi.requestPostEventHonorarium(programId),
    onSuccess: () => {
      invalidateAfterSurvey();
      onHonorariumRequestSubmitted?.();
    },
  });

  const { data: preview, isError: previewError, isLoading: previewLoading } = useQuery({
    queryKey: ['programs', programId, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(programId),
    enabled: needsPayoutPreview && payoutReadyOverride === null,
    retry: false,
  });

  const hasPayoutAccount = !!preview?.hasPayoutAccount;
  const previewPayoutReady = hasPayoutAccount && !!preview?.w9Submitted && !previewError;
  const payoutReady =
    payoutReadyOverride !== null ? payoutReadyOverride : previewPayoutReady;
  const waitingOnPayoutStatus =
    hasHonorarium && payoutReadyOverride === null && (previewLoading || (!preview && !previewError));

  const completeSurveyDisabled = nativeSurveyMode
    ? surveyFormSubmitting ||
      ackMut.isPending ||
      finalizeMut.isPending ||
      surveyAcked ||
      ackMut.isSuccess ||
      waitingOnPayoutStatus
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

  const handleFinalSubmit = () => {
    if (nativeSurveyMode || feedbackSurveyId) {
      finalizeMut.mutateAsync().catch(() => {});
    } else if (surveyAcked) {
      payMut.mutateAsync().catch(() => {});
    } else {
      finalizeMut.mutateAsync().catch(() => {});
    }
  };

  const finalSubmitBusy =
    finalizeMut.isPending ||
    payMut.isPending ||
    !!myRegistration?.honorariumRequestedAt ||
    !!myRegistration?.honorariumPayment ||
    finalizeMut.isSuccess ||
    payMut.isSuccess;

  const finalSubmitLabel =
    finalizeMut.isPending || payMut.isPending
      ? 'Submitting…'
      : myRegistration?.honorariumRequestedAt ||
          myRegistration?.honorariumPayment ||
          finalizeMut.isSuccess ||
          payMut.isSuccess
        ? 'Request submitted'
        : 'Submit survey';

  if (!myRegistration || !approved) {
    return null;
  }

  const connectedStatus = (
    <p className="text-sm font-medium text-success inline-flex flex-wrap items-center gap-2">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
      <span className="inline-flex flex-wrap items-center gap-1.5">
        Account connected via <StripeMark size="xs" className="translate-y-px" />
      </span>
    </p>
  );

  return (
    <div className="space-y-4">
      {showAckBlock ? (
        <div className="space-y-3">
          {nativeSurveyMode ? (
            hasHonorarium ? (
              waitingOnPayoutStatus ? (
                <p className="text-sm text-muted-foreground">Checking payout account…</p>
              ) : payoutReady ? (
                <>
                  {connectedStatus}
                  <p className="text-sm text-muted-foreground">
                    Complete the survey below, then tap <strong>Submit survey</strong> to finish.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete the survey below, then tap <strong>Continue</strong> to save a draft and set up your{' '}
                  <StripeMark size="sm" className="translate-y-px" /> payout account. You will return here to
                  submit the survey and payment request together.
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete the survey below, then tap <strong>Continue</strong> to save your answers.
              </p>
            )
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
              ? hasHonorarium && payoutReady
                ? 'Submitting…'
                : 'Saving…'
              : ackMut.isPending
                ? 'Saving…'
                : myRegistration.postEventSurveyAcknowledgedAt || ackMut.isSuccess
                  ? 'Survey recorded'
                  : nativeSurveyMode && hasHonorarium && payoutReady
                    ? 'Submit survey'
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
        <div className="space-y-4">
          {waitingOnPayoutStatus ? (
            <p className="text-sm text-muted-foreground">Loading payout status…</p>
          ) : payoutReady ? (
            <>
              {connectedStatus}
              <p className="text-sm text-muted-foreground">
                Your survey answers are saved as a draft. Tap <strong>Submit survey</strong> to finish.
              </p>
              {preview?.programTitle ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Program: </span>
                  {preview.programTitle}
                </p>
              ) : null}
              <button
                type="button"
                disabled={finalSubmitBusy}
                onClick={handleFinalSubmit}
                className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {finalSubmitLabel}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
                Your survey answers are saved as a draft. Set up your{' '}
                <StripeMark size="sm" className="translate-y-px" /> bank and tax details, then return here to
                submit the survey and payment request together.
              </p>
              {previewError ? (
                <p className="text-sm text-destructive">
                  Could not load payout status. Open Payments to finish setup, then try again.
                </p>
              ) : null}
              <Link
                to={payLink}
                className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                Set up payments
              </Link>
            </>
          )}

          {finalizeMut.isError || payMut.isError ? (
            <p className="text-sm text-destructive">
              Could not submit. Fix any payment issues above and try again.
            </p>
          ) : null}
          {finalizeMut.isSuccess ||
          payMut.isSuccess ||
          myRegistration.honorariumRequestedAt ||
          myRegistration.honorariumPayment ? (
            <p className="text-sm text-muted-foreground">
              Request received. Payouts are typically sent within{' '}
              <strong className="font-semibold text-foreground">14 calendar days</strong> after submission via ACH
              once your bank and tax details are connected.
            </p>
          ) : null}
        </div>
      ) : null}

      {showDoneBlock ? (
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
