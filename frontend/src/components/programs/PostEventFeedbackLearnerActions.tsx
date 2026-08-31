import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { programsApi, type ProgramRegistrationState } from '../../api/programs';
import { BillComMark } from '../branding/BillComMark';

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
          Your registration is approved. After the live session, attendance is recorded automatically when your
          email appears in Zoom for at least 30 minutes. The post-event survey unlocks once that happens.
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
 * Acknowledge post-event Jotform + optional honorarium confirmation (shared by program page and Surveys tab).
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
  /** Native in-app survey: Complete survey submits the form (no orange Submit on the form). */
  nativeSurveyMode?: boolean;
  surveyFormSubmitting?: boolean;
  surveySubmitError?: string | null;
  onCompleteSurveyNative?: () => void;
  /** e.g. program page: render the Jotform iframe between help text and the Complete survey button. */
  betweenAckHelpAndButton?: ReactNode;
  /** Program page: advance wizard after successful acknowledge (e.g. hide iframe for payout step). */
  onSurveyAcknowledged?: (opts: { hasHonorarium: boolean }) => void;
  /** Program page: advance to final step after honorarium request is created. */
  onHonorariumRequestSubmitted?: () => void;
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
  } = props;
  const queryClient = useQueryClient();

  const approved = myRegistration?.status === 'APPROVED';
  const att = myRegistration?.postEventAttendanceStatus;
  const attendanceOk = att === 'VERIFIED' || att === 'NOT_REQUIRED';

  const surveyAcked = !!myRegistration?.postEventSurveyAcknowledgedAt;
  const honorariumDone = !!(myRegistration?.honorariumRequestedAt || myRegistration?.honorariumPayment);

  const showPayoutBlock = surveyAcked && hasHonorarium && !honorariumDone && attendanceOk && approved;
  const showDoneBlock = surveyAcked && (!hasHonorarium || honorariumDone) && attendanceOk && approved;
  const showAckBlock =
    !surveyAcked && attendanceOk && approved && (manualSurveyAckRequired || nativeSurveyMode);

  const ackMut = useMutation({
    mutationFn: () => programsApi.acknowledgePostEventSurvey(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
      queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      if (surveyDetailId) {
        queryClient.invalidateQueries({ queryKey: ['survey', surveyDetailId] });
        queryClient.invalidateQueries({ queryKey: ['survey', surveyDetailId, 'my-response'] });
      }
      onSurveyAcknowledged?.({ hasHonorarium });
    },
  });

  const payMut = useMutation({
    mutationFn: () => programsApi.requestPostEventHonorarium(programId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', programId, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      if (surveyDetailId) {
        queryClient.invalidateQueries({ queryKey: ['survey', surveyDetailId] });
      }
      onHonorariumRequestSubmitted?.();
    },
  });

  const { data: preview, isError: previewError } = useQuery({
    queryKey: ['programs', programId, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(programId),
    enabled: showPayoutBlock,
    retry: false,
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
              When you are finished, tap <strong>Complete survey</strong> to save your responses
              {hasHonorarium ? ' before continuing to payout' : ''}. You can only submit this once.
            </p>
          ) : surveyReadyForAck ? (
            <p className="text-sm text-muted-foreground">
              {betweenAckHelpAndButton ? (
                <>
                  Submit the embedded survey, then tap <strong>Complete survey</strong> to record your response
                  {hasHonorarium ? ' before continuing to payout' : ''}. You can only submit this once.
                </>
              ) : (
                <>
                  We&apos;ve received your survey responses. Tap <strong>Complete survey</strong> to record your
                  response
                  {hasHonorarium ? ' before continuing to payout' : ''}.
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {betweenAckHelpAndButton ? (
                <>
                  Submit the embedded survey below, then return here and tap <strong>Complete survey</strong>
                  {hasHonorarium ? ' before confirming your honorarium' : ''}.
                </>
              ) : (
                <>
                  Use <strong>Start survey</strong> above (or open the embedded form), submit your responses, then return
                  here and tap <strong>Complete survey</strong>
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
                : 'Complete survey'}
          </button>
          {!nativeSurveyMode && ackMut.isError ? (
            <p className="text-sm text-destructive">Could not save progress. Check your connection and try again.</p>
          ) : null}
        </div>
      ) : null}

      {showPayoutBlock ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-1 gap-y-1">
            Review the payout details we will use for your honorarium. Add your{' '}
            <BillComMark size="sm" className="translate-y-px" /> profile and W-9 under{' '}
            <Link to="/app/payments" className="font-semibold underline">
              Payments
            </Link>{' '}
            if needed. When you continue, we queue an honorarium for processing; a <strong>pending</strong> payment appears
            for an administrator to approve and pay shortly after the job runs.
          </p>
          {previewError ? (
            <p className="text-sm text-destructive">
              Could not load payout preview. Open Payments to finish setup, then try again.
            </p>
          ) : !preview ? (
            <p className="text-sm text-muted-foreground">Loading payout summary…</p>
          ) : (
            <ul className="rounded-[6px] border border-border bg-muted px-4 py-3 text-sm text-foreground space-y-2">
              <li>
                <span className="font-medium text-foreground">Program: </span>
                {preview.programTitle}
              </li>
              <li>
                <span className="font-medium text-foreground">Honorarium: </span>
                {formatMoneyFromCents(preview.honorariumAmountCents)}
              </li>
              <li>
                <span className="font-medium text-foreground">Payee: </span>
                {preview.payeeDisplayName}
              </li>
              {preview.maskedBankLast4 ? (
                <li>
                  <span className="font-medium text-foreground">Bank account: </span>
                  {preview.maskedBankLast4}
                </li>
              ) : (
                <li className="text-amber-900">
                  Bank account on file could not be displayed. Confirm your details under{' '}
                  <Link to="/app/payments" className="font-semibold underline">
                    Payments
                  </Link>
                  .
                </li>
              )}
              {preview.addressSummary ? (
                <li>
                  <span className="font-medium text-foreground">Address on profile: </span>
                  {preview.addressSummary}
                </li>
              ) : null}
              {!preview.hasBillVendor ? (
                <li className="text-amber-900 flex flex-wrap items-center gap-x-1 gap-y-1">
                  Add your{' '}
                  <BillComMark size="xs" className="translate-y-px" /> payout profile under{' '}
                  <Link to="/app/payments" className="font-semibold underline">
                    Payments
                  </Link>{' '}
                  before continuing.
                </li>
              ) : null}
              {!preview.w9Submitted ? (
                <li className="text-amber-900">
                  Submit your W-9 under{' '}
                  <Link to="/app/payments" className="font-semibold underline">
                    Payments
                  </Link>{' '}
                  before continuing.
                </li>
              ) : null}
            </ul>
          )}
          <button
            type="button"
            disabled={
              payMut.isPending ||
              payMut.isSuccess ||
              !!myRegistration.honorariumRequestedAt ||
              !!myRegistration.honorariumPayment ||
              !preview ||
              !preview.hasBillVendor ||
              !preview.w9Submitted ||
              previewError
            }
            onClick={() => {
              payMut.mutateAsync().catch(() => {});
            }}
            className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {payMut.isPending
              ? 'Submitting…'
              : myRegistration.honorariumRequestedAt || myRegistration.honorariumPayment || payMut.isSuccess
                ? 'Request submitted'
                : 'Continue'}
          </button>
          {payMut.isError ? (
            <p className="text-sm text-destructive">Could not submit payment request. Fix any issues above and try again.</p>
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
