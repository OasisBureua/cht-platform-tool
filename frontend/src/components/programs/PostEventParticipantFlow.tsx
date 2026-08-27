import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Program, ProgramRegistrationState } from '../../api/programs';
import { isPostEventSurveyUnlocked } from '../../utils/post-event-survey';
import { PostEventFeedbackLearnerActions } from './PostEventFeedbackLearnerActions';
import { StripeMark } from '../branding/StripeMark';
import { ProgramSurveyPanel } from '../surveys/ProgramSurveyPanel';

type Phase = 'intro' | 'survey' | 'payout' | 'done';

const POST_EVENT_NATIVE_FORM_ID = 'post-event-native-survey';

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
    | 'hasPostEventSurvey'
    | 'feedbackSurveyId'
    | 'feedbackUsesJotform'
    | 'honorariumAmount'
    | 'zoomSessionType'
    | 'startDate'
    | 'duration'
    | 'zoomSessionEndedAt'
  >;
  userId: string;
  userSummary?: { firstName?: string; lastName?: string; email?: string };
  enrolled: boolean;
  myRegistration: ProgramRegistrationState | null | undefined;
  /** While true, parent should hide the page "Back" control so the learner cannot return mid-flow. */
  onPostEventNavLockChange?: (locked: boolean) => void;
}) {
  const { program, userId, userSummary, enrolled, myRegistration, onPostEventNavLockChange } = props;
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('intro');
  const [flowStarted, setFlowStarted] = useState(() => readFlowStarted(program.id));
  const [nativeSurveySubmitting, setNativeSurveySubmitting] = useState(false);
  const [nativeSurveyError, setNativeSurveyError] = useState<string | null>(null);

  const hasSurvey =
    program.hasPostEventSurvey ?? !!program.jotformSurveyUrl?.trim();
  const surveySubmitted = !!myRegistration?.postEventSurveySubmitted;
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
    // Jotform submission recorded server-side → user already filled the form; drop into survey phase
    // so they can click "Complete survey" even if localStorage was cleared (new device, incognito, etc.)
    const jotformSubmitted = surveySubmitted;

    if (hasSurvey && !ack) {
      if (flowStarted || jotformSubmitted) setPhase('survey');
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
      <section className="bg-card border border-border rounded-card p-6 space-y-2">
        <h2 className="text-base font-semibold text-foreground">Post-event steps</h2>
        <p className="text-sm text-muted-foreground">
          Your registration is approved. An administrator still needs to <strong>verify attendance</strong> after the
          live session before the post-event survey and honorarium steps unlock here.
        </p>
      </section>
    );
  }

  if (attendanceDenied) {
    return (
      <section className="rounded-card border border-destructive/25 bg-destructive/10 p-6 space-y-2">
        <h2 className="text-base font-semibold text-red-900">Attendance not verified</h2>
        <p className="text-sm text-destructive">
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

  const jotformSubmitted = surveySubmitted;
  const surveyStepLabel = hasSurvey
    ? surveyAcked
      ? 'Survey complete'
      : jotformSubmitted
        ? 'Survey in progress'
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

  const nativePostEventSurvey = !!program.feedbackSurveyId;

  useEffect(() => {
    if (phase !== 'survey') {
      setNativeSurveySubmitting(false);
    }
  }, [phase]);

  const advanceAfterSurvey = () => {
    if (hasHonorarium) setPhase('payout');
    else setPhase('done');
  };

  const handleCompleteNativeSurvey = () => {
    setNativeSurveyError(null);
    if (surveySubmitted || surveyAcked) {
      advanceAfterSurvey();
      return;
    }
    const form = document.getElementById(POST_EVENT_NATIVE_FORM_ID) as HTMLFormElement | null;
    if (!form) {
      advanceAfterSurvey();
      return;
    }
    if (!form.reportValidity()) {
      setNativeSurveyError('Complete all required fields before tapping Complete survey.');
      return;
    }
    form.dataset.chtExplicitSubmit = '1';
    form.requestSubmit();
  };

  return (
    <section className="bg-card border border-border rounded-card p-6 space-y-4">
      <h2 className="text-base font-semibold text-foreground">Post-event steps</h2>

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
                    done ? 'text-success' : current ? 'text-gray-900' : 'text-gray-400',
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
          <p className="text-sm text-muted-foreground">
            {hasSurvey ? (
              <>
                Complete the post-event survey in the next step to save your responses.
                {hasHonorarium ? (
                  <>
                    {' '}
                    Honorarium amount and payout steps are shown there after you submit.
                  </>
                ) : null}{' '}
                You cannot return to a previous step after you continue.
              </>
            ) : hasHonorarium ? (
              <>
                Confirm you are ready to submit your honorarium request. Payout is processed by an administrator through{' '}
                <StripeMark size="sm" className="mx-0.5 translate-y-px" />
                . After you continue, you <strong>cannot</strong> return to this step.
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={begin}
            className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
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
          surveyReadyForAck={surveySubmitted}
          manualSurveyAckRequired={!nativePostEventSurvey}
          nativeSurveyMode={nativePostEventSurvey}
          surveyFormSubmitting={nativeSurveySubmitting}
          surveySubmitError={nativeSurveyError}
          onCompleteSurveyNative={handleCompleteNativeSurvey}
          betweenAckHelpAndButton={
            surveySubmitted && !nativePostEventSurvey ? null : program.feedbackSurveyId ? (
              <ProgramSurveyPanel
                surveyId={program.feedbackSurveyId}
                userId={userId}
                programId={program.id}
                authenticated
                userSummary={userSummary}
                hideSubmitButton={nativePostEventSurvey}
                formId={nativePostEventSurvey ? POST_EVENT_NATIVE_FORM_ID : undefined}
                onSubmittingChange={setNativeSurveySubmitting}
                onSubmitError={() => {
                  setNativeSurveySubmitting(false);
                  setNativeSurveyError('Could not save survey. Check your connection and try again.');
                }}
                onSubmitted={() => {
                  setNativeSurveySubmitting(false);
                  setNativeSurveyError(null);
                  queryClient.invalidateQueries({ queryKey: ['program', program.id, 'registration'] });
                  queryClient.invalidateQueries({ queryKey: ['survey', program.feedbackSurveyId, 'my-response'] });
                  advanceAfterSurvey();
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No native post-event survey is configured for this session yet.
              </p>
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
