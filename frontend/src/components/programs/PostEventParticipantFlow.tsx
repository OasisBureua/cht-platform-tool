import { useEffect, useState } from 'react';
import type { Program, ProgramRegistrationState } from '../../api/programs';
import { buildPostEventSurveyEmbedSrc, isPostEventSurveyUnlocked } from '../../utils/post-event-survey';
import { PostEventFeedbackLearnerActions } from './PostEventFeedbackLearnerActions';

type Phase = 'intro' | 'survey' | 'payout' | 'done';

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
  const [phase, setPhase] = useState<Phase>('intro');

  const hasSurvey = !!program.jotformSurveyUrl?.trim();
  const hasHonorarium = !!program.honorariumAmount && program.honorariumAmount > 0;
  const timeUnlocked = isPostEventSurveyUnlocked(program);
  const att = myRegistration?.postEventAttendanceStatus;
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
        <PostEventFeedbackLearnerActions
          programId={program.id}
          userId={userId}
          myRegistration={myRegistration}
          hasHonorarium={hasHonorarium}
          surveyReadyForAck
          betweenAckHelpAndButton={
            <div className="min-h-[400px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
              <iframe
                title="Post-event survey"
                src={buildPostEventSurveyEmbedSrc(program.jotformSurveyUrl!, userId, program.id)}
                className="w-full h-[480px]"
                allow="camera; microphone"
              />
            </div>
          }
          onSurveyAcknowledged={({ hasHonorarium: h }) => {
            if (h) setPhase('payout');
            else setPhase('done');
          }}
        />
      ) : null}

      {phase === 'payout' && hasHonorarium ? (
        <PostEventFeedbackLearnerActions
          programId={program.id}
          userId={userId}
          myRegistration={myRegistration}
          hasHonorarium={hasHonorarium}
          surveyReadyForAck={false}
          onHonorariumRequestSubmitted={() => setPhase('done')}
        />
      ) : null}

      {phase === 'done' ? (
        <PostEventFeedbackLearnerActions
          programId={program.id}
          userId={userId}
          myRegistration={myRegistration}
          hasHonorarium={hasHonorarium}
          surveyReadyForAck={false}
        />
      ) : null}
    </section>
  );
}
