import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { programsApi, type ProgramRegistrationState } from '../../api/programs';

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
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Post-event steps</h2>
        <p className="text-sm text-gray-600">
          Your registration is approved. An administrator still needs to <strong>verify attendance</strong> after the live
          session before the post-event survey and honorarium steps unlock here.
        </p>
      </section>
    );
  }
  if (att === 'DENIED') {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <h2 className="text-base font-semibold text-red-900">Attendance not verified</h2>
        <p className="text-sm text-red-800">
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
  const showAckBlock = !surveyAcked && attendanceOk && approved;

  const { data: preview, isError: previewError } = useQuery({
    queryKey: ['programs', programId, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(programId),
    enabled: showPayoutBlock,
    retry: false,
  });

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

  if (!myRegistration || !approved) {
    return null;
  }

  return (
    <div className="space-y-4">
      {showAckBlock ? (
        <div className="space-y-3">
          {surveyReadyForAck ? (
            <p className="text-sm text-gray-600">
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
            <p className="text-sm text-gray-600">
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
          <button
            type="button"
            disabled={
              !surveyReadyForAck || ackMut.isPending || !!myRegistration.postEventSurveyAcknowledgedAt || ackMut.isSuccess
            }
            onClick={() => {
              ackMut.mutateAsync().catch(() => {});
            }}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {ackMut.isPending
              ? 'Saving…'
              : myRegistration.postEventSurveyAcknowledgedAt || ackMut.isSuccess
                ? 'Survey recorded'
                : 'Complete survey'}
          </button>
          {ackMut.isError ? (
            <p className="text-sm text-red-700">Could not save progress. Check your connection and try again.</p>
          ) : null}
        </div>
      ) : null}

      {showPayoutBlock ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Review the payout details we will use for your honorarium. Add your Bill.com profile and W-9 under{' '}
            <Link to="/app/payments" className="font-semibold underline">
              Payments
            </Link>{' '}
            if needed.             When you continue, we queue an honorarium for processing; a <strong>pending</strong> payment appears
            for an administrator to approve and pay shortly after the job runs.
          </p>
          {previewError ? (
            <p className="text-sm text-red-700">
              Could not load payout preview. Open Payments to finish setup, then try again.
            </p>
          ) : !preview ? (
            <p className="text-sm text-gray-500">Loading payout summary…</p>
          ) : (
            <ul className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 space-y-2">
              <li>
                <span className="font-medium text-gray-900">Program: </span>
                {preview.programTitle}
              </li>
              <li>
                <span className="font-medium text-gray-900">Honorarium: </span>
                {formatMoneyFromCents(preview.honorariumAmountCents)}
              </li>
              <li>
                <span className="font-medium text-gray-900">Payee: </span>
                {preview.payeeDisplayName}
              </li>
              {preview.maskedBankLast4 ? (
                <li>
                  <span className="font-medium text-gray-900">Bank account: </span>
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
                  <span className="font-medium text-gray-900">Address on profile: </span>
                  {preview.addressSummary}
                </li>
              ) : null}
              {!preview.hasBillVendor ? (
                <li className="text-amber-900">
                  Add your Bill.com payout profile under{' '}
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
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {payMut.isPending
              ? 'Submitting…'
              : myRegistration.honorariumRequestedAt || myRegistration.honorariumPayment || payMut.isSuccess
                ? 'Request submitted'
                : 'Continue'}
          </button>
          {payMut.isError ? (
            <p className="text-sm text-red-700">Could not submit payment request. Fix any issues above and try again.</p>
          ) : null}
        </div>
      ) : null}

      {showDoneBlock ? (
        <div className="space-y-2">
          {hasHonorarium ? (
            <>
              <p className="text-sm text-gray-700">
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
              <Link to="/app/payments" className="inline-flex text-sm font-semibold text-gray-900 underline">
                Open Payments
              </Link>
            </>
          ) : (
            <p className="text-sm text-gray-700">Thank you—your post-event survey response is recorded.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
