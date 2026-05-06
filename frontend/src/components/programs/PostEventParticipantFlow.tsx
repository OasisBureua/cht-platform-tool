import { useEffect, useState } from 'react';
import type { Program, ProgramRegistrationState } from '../../api/programs';
import { buildPostEventSurveyEmbedSrc, isPostEventSurveyUnlocked } from '../../utils/post-event-survey';
import { PostEventFeedbackLearnerActions } from './PostEventFeedbackLearnerActions';

type Phase = 'intro' | 'survey' | 'payout' | 'done';

/** Persists across refresh: user clicked Continue for this program and is committed to the flow. */
function flowStartedKey(programId: string) {
  return `post-event-flow-started:${programId}`;
}

function readFlowStarted(programId: string): boolean {
  try {
    return localStorage.getItem(flowStartedKey(programId)) === '1';
  } catch {
    return false;
  }
}

function writeFlowStarted(programId: string) {
  try {
    localStorage.setItem(flowStartedKey(programId), '1');
  } catch {}
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
  const [phase, setPhase] = useState<Phase>('intro');
  const [flowStarted, setFlowStarted] = useState(() => readFlowStarted(program.id));

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
    setFlowStarted(readFlowStarted(program.id));
  }, [program.id]);

  // Resume from server (e.g. refresh) when sitting at intro.
  useEffect(() => {
    if (!myRegistration || !showFlow) return;
    if (phase !== 'intro') return;
    const ack = !!myRegistration.postEventSurveyAcknowledgedAt;
    const req = !!myRegistration.honorariumRequestedAt;

    if (hasSurvey && !ack) {
      // User already clicked Continue in a previous session — skip the intro gating screen
      // and drop them back into the survey so they can complete it.
      if (flowStarted) setPhase('survey');
      return;
    }

    if (hasHonorarium) {
      if (req || myRegistration.honorariumPayment) {
        setPhase('done');
      } else {
        setPhase('payout');
      }
    } else if (ack) {
      setPhase('done');
    }
  }, [myRegistration, showFlow, hasSurvey, hasHonorarium, phase, program.id, flowStarted]);

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
    writeFlowStarted(program.id);
    setFlowStarted(true);
    if (hasSurvey) setPhase('survey');
    else if (hasHonorarium) setPhase('payout');
    else setPhase('done');
  };

  const surveyAcked = !!myRegistration?.postEventSurveyAcknowledgedAt;
  const honorariumDone = !!(myRegistration?.honorariumRequestedAt || myRegistration?.honorariumPayment);

  const surveyStepLabel = hasSurvey
    ? surveyAcked
      ? 'Survey complete'
      : flowStarted && phase === 'survey'
        ? 'Survey pending'
        : 'Survey required'
    : 'Survey required';

  const steps = [
    { key: 'survey', label: surveyStepLabel, active: phase === 'intro' || phase === 'survey' },
    { key: 'payout', label: hasHonorarium ? (honorariumDone ? 'Payment submitted' : 'Payment info needed') : 'Payment info', active: phase === 'payout' },
    { key: 'done', label: 'Complete', active: phase === 'done' },
  ];
  const activeStep =
    phase === 'intro' || phase === 'survey' ? 0 : phase === 'payout' ? 1 : 2;

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-900">Post-event steps</h2>

      {/* Status ladder */}
      <ol className="flex items-center gap-0" aria-label="Post-event progress">
        {steps.map((step, idx) => {
          const done = idx < activeStep;
          const current = idx === activeStep;
          return (
            <li key={step.key} className="flex items-center min-w-0">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    done
                      ? 'bg-green-600 text-white'
                      : current
                        ? 'bg-gray-900 text-white ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-gray-100 text-gray-400',
                  ].join(' ')}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <span
                  className={[
                    'mt-1 text-[11px] font-semibold text-center whitespace-nowrap',
                    done ? 'text-green-700' : current ? 'text-gray-900' : 'text-gray-400',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={['mx-2 h-px w-8 shrink-0 self-start mt-3', done ? 'bg-green-400' : 'bg-gray-200'].join(' ')} />
              )}
            </li>
          );
        })}
      </ol>

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
          surveyReadyForAck={Boolean(myRegistration?.postEventJotformSubmissionId)}
          betweenAckHelpAndButton={
            myRegistration?.postEventJotformSubmissionId &&
            !myRegistration.postEventSurveyAcknowledgedAt ? null : (
              <div className="min-h-[400px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                <iframe
                  title="Post-event survey"
                  src={buildPostEventSurveyEmbedSrc(program.jotformSurveyUrl!, userId, program.id)}
                  className="w-full h-[480px]"
                  allow="camera; microphone"
                />
              </div>
            )
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
