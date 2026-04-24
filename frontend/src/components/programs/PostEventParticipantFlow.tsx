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
}) {
  const { program, userId, enrolled, myRegistration } = props;
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('intro');

  const hasSurvey = !!program.jotformSurveyUrl?.trim();
  const hasHonorarium = !!program.honorariumAmount && program.honorariumAmount > 0;
  const timeUnlocked = isPostEventSurveyUnlocked(program);
  const att = myRegistration?.postEventAttendanceStatus;
  const attendanceOk = att === 'VERIFIED' || att === 'NOT_REQUIRED';
  const attendancePending = att === 'PENDING_VERIFICATION';
  const attendanceDenied = att === 'DENIED';

  useEffect(() => {
    setPhase('intro');
  }, [program.id]);

  const showFlow =
    enrolled &&
    !!userId &&
    timeUnlocked &&
    (hasSurvey || hasHonorarium) &&
    !!myRegistration &&
    myRegistration.status === 'APPROVED';

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
                Complete the post-event survey after the live session. Each time you tap <strong>Continue</strong>, you
                move forward—you <strong>cannot</strong> go back to a previous step.
              </>
            ) : (
              <>
                Confirm your payout details for the honorarium. After you continue, you <strong>cannot</strong> go back
                to change this step.
              </>
            )}
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
            Submit the embedded survey, then tap <strong>Continue</strong> to confirm you have finished.
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
            disabled={ackMut.isPending}
            onClick={() => afterSurvey().catch(() => {})}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {ackMut.isPending ? 'Saving…' : 'Continue'}
          </button>
          {ackMut.isError ? (
            <p className="text-sm text-red-700">Could not save progress. Check your connection and try again.</p>
          ) : null}
        </>
      ) : null}

      {phase === 'payout' && hasHonorarium ? (
        <>
          <p className="text-sm text-gray-600">
            Review the payout details we will use for your honorarium. Only masked account information is shown for
            security. Tap <strong>Continue</strong> to submit your payment request to an administrator.
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
              !preview ||
              !preview.hasBillVendor ||
              !preview.w9Submitted ||
              previewError
            }
            onClick={() => afterPayoutConfirm().catch(() => {})}
            className="inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {payMut.isPending ? 'Submitting…' : 'Continue'}
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
                    Your honorarium request is with an administrator. When they use <strong>Pay now</strong>, funds are
                    sent via Bill.com and your status updates to paid.
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
