import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { programsApi, type Program, type ProgramRegistrationState } from '../../api/programs';
import { buildPostEventSurveyEmbedSrc, isPostEventSurveyUnlocked } from '../../utils/post-event-survey';

type Phase = 'intro' | 'survey' | 'payout' | 'done';

function formatMoneyFromCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PostEventParticipantFlow(props: {
  program: Pick<
    Program,
    | 'id'
    | 'jotformSurveyUrl'
    | 'honorariumAmount'
    | 'zoomSessionType'
    | 'startDate'
    | 'duration'
    | 'zoomSessionEndedAt'
  >;
  userId: string;
  enrolled: boolean;
  myRegistration: ProgramRegistrationState | null | undefined;
  /** While true, parent should hide the page "Back" control so the learner cannot return mid-flow. */
  onPostEventNavLockChange?: (locked: boolean) => void;
}) {
  const { program, userId, enrolled, myRegistration, onPostEventNavLockChange } = props;
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('intro');

  const hasSurvey = !!program.jotformSurveyUrl?.trim();
  const hasHonorarium = !!program.honorariumAmount && program.honorariumAmount > 0;
  const timeUnlocked = isPostEventSurveyUnlocked(program);
  const att = myRegistration?.postEventAttendanceStatus;
  const attendanceOk = att === 'VERIFIED' || att === 'NOT_REQUIRED';
  const attendancePending = att === 'PENDING_VERIFICATION';
  const attendanceDenied = att === 'DENIED';

  const showFlow =
    enrolled &&
    !!userId &&
    timeUnlocked &&
    (hasSurvey || hasHonorarium) &&
    !!myRegistration &&
    myRegistration.status === 'APPROVED';

  const flowBackLocked = showFlow && phase !== 'intro' && phase !== 'done';

  useEffect(() => {
    onPostEventNavLockChange?.(flowBackLocked);
    return () => onPostEventNavLockChange?.(false);
  }, [flowBackLocked, onPostEventNavLockChange]);

  /** Prevent browser back from undoing a committed step in this sub-flow. */
  useEffect(() => {
    if (!flowBackLocked) return;
    const onPop = () => {
      window.history.pushState({ postEventFlowLock: 1 }, '', window.location.href);
    };
    window.history.pushState({ postEventFlowLock: 1 }, '', window.location.href);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [flowBackLocked]);

  useEffect(() => {
    setPhase('intro');
  }, [program.id]);

  // Resume from server (e.g. refresh) when sitting at intro.
  useEffect(() => {
    if (!myRegistration || !showFlow) return;
    if (phase !== 'intro') return;
    const ack = !!myRegistration.postEventSurveyAcknowledgedAt;
    const req = !!myRegistration.honorariumRequestedAt;
    if (hasSurvey && !ack) return;
    if (hasHonorarium) {
      if (req || myRegistration.honorariumPayment) {
        setPhase('done');
      } else {
        setPhase('payout');
      }
    } else if (ack) {
      setPhase('done');
    }
  }, [myRegistration, showFlow, hasSurvey, hasHonorarium, phase, program.id]);

  /** Refresh mid-flow: survey already saved server-side → advance to payout or done. */
  useEffect(() => {
    if (!myRegistration || !showFlow || phase !== 'survey' || !hasSurvey) return;
    if (!myRegistration.postEventSurveyAcknowledgedAt) return;
    if (hasHonorarium && !myRegistration.honorariumRequestedAt && !myRegistration.honorariumPayment) {
      setPhase('payout');
    } else {
      setPhase('done');
    }
  }, [
    myRegistration,
    showFlow,
    phase,
    hasSurvey,
    hasHonorarium,
    program.id,
    myRegistration?.postEventSurveyAcknowledgedAt,
    myRegistration?.honorariumRequestedAt,
    myRegistration?.honorariumPayment,
  ]);

  const { data: preview, isError: previewError } = useQuery({
    queryKey: ['programs', program.id, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(program.id),
    enabled: showFlow && attendanceOk && phase === 'payout' && hasHonorarium,
    retry: false,
  });

  const ackMut = useMutation({
    mutationFn: () => programsApi.acknowledgePostEventSurvey(program.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', program.id, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['programs', 'live-action-items'] });
      queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
    },
  });

  const payMut = useMutation({
    mutationFn: () => programsApi.requestPostEventHonorarium(program.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program', program.id, 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['payments', userId, 'summary'] });
    },
  });

  if (!showFlow) {
    return null;
  }

  if (attendancePending) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-2">
        <h2 className="text-base font-semibold text-gray-900">Post-event steps</h2>
        <p className="text-sm text-gray-600">
          Your registration is approved. An administrator still needs to <strong>verify attendance</strong> after the
          live session before the post-event survey and honorarium steps unlock here.
        </p>
      </section>
    );
  }

  if (attendanceDenied) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <h2 className="text-base font-semibold text-red-900">Attendance not verified</h2>
        <p className="text-sm text-red-800">
          Your attendance could not be verified for this session. If you believe this is a mistake, contact support.
        </p>
      </section>
    );
  }

  const begin = () => {
    if (hasSurvey) setPhase('survey');
    else if (hasHonorarium) setPhase('payout');
    else setPhase('done');
  };

  const afterSurvey = async () => {
    await ackMut.mutateAsync();
    if (hasHonorarium) setPhase('payout');
    else setPhase('done');
  };

  const afterPayoutConfirm = async () => {
    await payMut.mutateAsync();
    setPhase('done');
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Post-event steps</h2>

      {phase === 'intro' ? (
        <>
          <p className="text-sm text-gray-600">
            {hasSurvey ? (
              <>
                Complete the post-event survey in the next step, then use <strong>Complete survey</strong> to save your
                progress.
                {hasHonorarium ? (
                  <>
                    {' '}
                    On the next screen, confirm your payout details and use <strong>Continue</strong> to create a{' '}
                    <strong>pending</strong> honorarium for an administrator to review and pay.
                  </>
                ) : null}{' '}
                You cannot return to a previous step after you continue.
              </>
            ) : hasHonorarium ? (
              <>
                Confirm you are ready to submit your honorarium request. Payout is processed by an administrator through
                Bill.com. After you continue, you <strong>cannot</strong> return to this step.
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={begin}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            Continue
          </button>
        </>
      ) : null}

      {phase === 'survey' && hasSurvey ? (
        <>
          <p className="text-sm text-gray-600">
            Submit the embedded survey, then tap <strong>Complete survey</strong> to record your response
            {hasHonorarium ? ' before continuing to payout' : ''}. You will not be able to go back afterward.
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
            disabled={
              ackMut.isPending ||
              !!myRegistration?.postEventSurveyAcknowledgedAt ||
              ackMut.isSuccess
            }
            onClick={() => afterSurvey().catch(() => {})}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {ackMut.isPending
              ? 'Saving…'
              : myRegistration?.postEventSurveyAcknowledgedAt || ackMut.isSuccess
                ? 'Survey recorded'
                : 'Complete survey'}
          </button>
          {ackMut.isError ? (
            <p className="text-sm text-red-700">Could not save progress. Check your connection and try again.</p>
          ) : null}
        </>
      ) : null}

      {phase === 'payout' && hasHonorarium ? (
        <>
          <p className="text-sm text-gray-600">
            Review the payout details we will use for your honorarium. Add your Bill.com profile and W-9 under{' '}
            <Link to="/app/payments" className="font-semibold underline">
              Payments
            </Link>{' '}
            if needed. When you continue, a <strong>pending</strong> payment is created for an administrator to approve
            and pay.
          </p>
          {previewError ? (
            <p className="text-sm text-red-700">Could not load payout preview. Open Payments to finish setup, then try again.</p>
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
              !!myRegistration?.honorariumRequestedAt ||
              !!myRegistration?.honorariumPayment ||
              !preview ||
              !preview.hasBillVendor ||
              !preview.w9Submitted ||
              previewError
            }
            onClick={() => afterPayoutConfirm().catch(() => {})}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {payMut.isPending
              ? 'Submitting…'
              : myRegistration?.honorariumRequestedAt || myRegistration?.honorariumPayment || payMut.isSuccess
                ? 'Request submitted'
                : 'Continue'}
          </button>
          {payMut.isError ? (
            <p className="text-sm text-red-700">Could not submit payment request. Fix any issues above and try again.</p>
          ) : null}
        </>
      ) : null}

      {phase === 'done' ? (
        <div className="space-y-2">
          {hasHonorarium ? (
            <>
              <p className="text-sm text-gray-700">
                {myRegistration?.honorariumPayment?.status === 'PAID' ? (
                  <>Your honorarium has been marked paid.</>
                ) : (
                  <>
                    A <strong>pending</strong> honorarium is on file. An administrator will review and use{' '}
                    <strong>Pay now</strong> in the admin tools when ready; you will see the status under Payments when
                    it is sent.
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
    </section>
  );
}
