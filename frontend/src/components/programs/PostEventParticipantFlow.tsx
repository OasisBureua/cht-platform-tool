import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { programsApi, type Program, type ProgramRegistrationState } from '../../api/programs';
import { surveysApi } from '../../api/surveys';
import { isPostEventSurveyUnlocked } from '../../utils/post-event-survey';
import {
  attendanceRecorded,
  derivePostEventProgress,
  parsePostEventStepKey,
  postEventFactsFromRegistration,
  postEventHeroCopy,
  type PostEventStepKey,
} from '../../utils/post-event-steps';
import { PostEventFeedbackLearnerActions } from './PostEventFeedbackLearnerActions';
import { PostEventDrawer } from './PostEventDrawer';
import { PostEventHero } from './PostEventHero';
import { PostEventWizard } from './PostEventWizard';
import {
  PostEventAttendPending,
  PostEventAttendReview,
  PostEventConfirmation,
  PostEventNotAttendee,
  PostEventPaymentReview,
  PostEventSurveyReview,
} from './PostEventStepPanels';
import { ProgramSurveyPanel } from '../surveys/ProgramSurveyPanel';
import { programHasHonorarium } from '../../utils/program-has-honorarium';

const POST_EVENT_NATIVE_FORM_ID = 'post-event-native-survey';

/** Persists across refresh: user started the survey for this program and is committed to the flow. */
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
  } catch {
    // localStorage unavailable (private mode or quota)
  }
}

/**
 * Post-event flow on the program page (SCRUM-288): a hero with the next step to get paid and one
 * button, which opens a drawer (bottom sheet on phones) holding a focused one-step-at-a-time wizard
 * (attend, survey, payment info, done). Which step is in progress comes from server data
 * (see utils/post-event-steps), so a returning learner lands on the first incomplete step.
 * Done steps can be opened from the hero or the wizard progress bar to review them.
 */
export default function PostEventParticipantFlow(props: {
  program: Pick<
    Program,
    | 'id'
    | 'jotformSurveyUrl'
    | 'hasPostEventSurvey'
    | 'feedbackSurveyId'
    | 'feedbackUsesJotform'
    | 'honorariumAmount'
    | 'hasHonorarium'
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
  const [searchParams] = useSearchParams();
  const [flowStarted, setFlowStarted] = useState(() => readFlowStarted(program.id));
  const [nativeSurveySubmitting, setNativeSurveySubmitting] = useState(false);
  const [nativeSurveyError, setNativeSurveyError] = useState<string | null>(null);
  /** Bridge the registration refetch after a step finishes, so the map advances without flashing back. */
  const [localSurveyDone, setLocalSurveyDone] = useState(false);
  const [localPaymentDone, setLocalPaymentDone] = useState(false);
  /** A done step opened from the map (or `?step=` from the dashboard card). Null follows the step in progress. */
  const [viewingKey, setViewingKey] = useState<PostEventStepKey | null>(() =>
    parsePostEventStepKey(searchParams.get('step')),
  );
  /** Arriving from the dashboard card (`?step=`) opens the wizard straight away. */
  const [drawerOpen, setDrawerOpen] = useState(() => parsePostEventStepKey(searchParams.get('step')) !== null);

  const hasSurvey = program.hasPostEventSurvey ?? !!program.jotformSurveyUrl?.trim();
  const surveySubmitted = !!myRegistration?.postEventSurveySubmitted;
  const hasHonorarium = programHasHonorarium(program);
  const feedbackSurveyId = program.feedbackSurveyId;
  const nativePostEventSurvey = !!feedbackSurveyId;

  const { data: mySurveyResponse } = useQuery({
    queryKey: ['survey', feedbackSurveyId, 'my-response'],
    queryFn: () => surveysApi.getMyResponse(feedbackSurveyId!),
    enabled: Boolean(feedbackSurveyId && userId && hasSurvey),
  });
  const hasSurveyDraft = !!mySurveyResponse?.draft;
  const timeUnlocked = isPostEventSurveyUnlocked(program);
  const attendanceOk = attendanceRecorded(myRegistration?.postEventAttendanceStatus);

  const showFlow =
    enrolled &&
    !!userId &&
    timeUnlocked &&
    (hasSurvey || hasHonorarium) &&
    !!myRegistration &&
    myRegistration.status === 'APPROVED';

  const registrationFacts = postEventFactsFromRegistration({
    registration: myRegistration,
    hasSurvey,
    hasHonorarium,
    nativeSurvey: nativePostEventSurvey,
    surveyDraftSaved: hasSurveyDraft,
  });
  const facts = {
    ...registrationFacts,
    surveyAcknowledged: registrationFacts.surveyAcknowledged || localSurveyDone,
    paymentInfoConfirmed: registrationFacts.paymentInfoConfirmed || localPaymentDone,
    paymentStatus: registrationFacts.paymentStatus ?? (localPaymentDone ? 'PENDING' : null),
  };
  const paymentStepInProgress =
    showFlow && hasHonorarium && attendanceOk && derivePostEventProgress(facts).active.key === 'payment';

  // Same query as PostEventPayoutStep, so the map can flag missing payout details without a second request.
  const { data: payoutPreview } = useQuery({
    queryKey: ['programs', program.id, 'honorarium-preview'],
    queryFn: () => programsApi.getHonorariumPreview(program.id),
    enabled: paymentStepInProgress,
    retry: false,
  });
  const progress = derivePostEventProgress({
    ...facts,
    payoutReady: paymentStepInProgress ? payoutPreview?.payoutReady : undefined,
  });

  const viewingStep = viewingKey
    ? progress.steps.find((s) => s.key === viewingKey && s.state !== 'not_started')
    : undefined;
  const shown = viewingStep ?? progress.active;
  const reviewing = shown.key !== progress.active.key;

  const midFlow = flowStarted || hasSurveyDraft || surveySubmitted || facts.surveyAcknowledged;
  const flowBackLocked =
    showFlow &&
    attendanceOk &&
    midFlow &&
    (progress.active.key === 'survey' || progress.active.key === 'payment');

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

  const [prevProgramId, setPrevProgramId] = useState(program.id);
  if (program.id !== prevProgramId) {
    setPrevProgramId(program.id);
    setFlowStarted(readFlowStarted(program.id));
    setLocalSurveyDone(false);
    setLocalPaymentDone(false);
    setViewingKey(null);
    setDrawerOpen(false);
  }

  const [prevShownKey, setPrevShownKey] = useState(shown.key);
  if (shown.key !== prevShownKey) {
    setPrevShownKey(shown.key);
    if (shown.key !== 'survey') setNativeSurveySubmitting(false);
  }

  /**
   * After the learner finishes a step or opens one from the map, move focus to the step heading so
   * keyboard and screen reader users follow along. Data loading on its own never moves focus.
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusOnStepChange = useRef(false);
  useEffect(() => {
    if (!focusOnStepChange.current) return;
    focusOnStepChange.current = false;
    headingRef.current?.focus();
  }, [shown.key]);

  /** Arriving from the dashboard card (`?step=`): bring the hero into view behind the wizard. */
  const sectionRef = useRef<HTMLElement>(null);
  const scrolledFromLink = useRef(false);
  const arrivedWithStep = searchParams.has('step');
  useEffect(() => {
    if (!arrivedWithStep || scrolledFromLink.current || !showFlow || !sectionRef.current) return;
    scrolledFromLink.current = true;
    sectionRef.current.scrollIntoView?.({ block: 'start' });
  }, [arrivedWithStep, showFlow]);

  if (!showFlow || !myRegistration) {
    return null;
  }

  if (!progress.attendee) {
    return <PostEventNotAttendee />;
  }

  const startSurvey = () => {
    writeFlowStarted(program.id);
    setFlowStarted(true);
  };

  const finishSurvey = () => {
    focusOnStepChange.current = true;
    setLocalSurveyDone(true);
    setViewingKey(null);
  };

  const handleCompleteNativeSurvey = () => {
    setNativeSurveyError(null);
    if (facts.surveyAcknowledged) {
      finishSurvey();
      return;
    }
    if (hasSurveyDraft && hasHonorarium) {
      finishSurvey();
      return;
    }
    if (surveySubmitted && !hasHonorarium) {
      finishSurvey();
      return;
    }
    const form = document.getElementById(POST_EVENT_NATIVE_FORM_ID) as HTMLFormElement | null;
    if (!form) {
      finishSurvey();
      return;
    }
    if (!form.reportValidity()) {
      setNativeSurveyError('Complete all required fields before continuing.');
      return;
    }
    form.dataset.chtExplicitSubmit = '1';
    form.requestSubmit();
  };

  const selectStep = (key: PostEventStepKey) => {
    if (key !== shown.key) focusOnStepChange.current = true;
    setViewingKey(key === progress.active.key ? null : key);
  };

  const surveyOpen = flowStarted || hasSurveyDraft || surveySubmitted;

  /** Hero button opens the step in progress (starting the survey in the same tap); pills open that step. */
  const openWizard = (key?: PostEventStepKey) => {
    if (key) {
      setViewingKey(key === progress.active.key ? null : key);
    } else {
      setViewingKey(null);
      if (progress.active.key === 'survey' && !surveyOpen) startSurvey();
    }
    setDrawerOpen(true);
  };

  let panel: ReactNode = null;
  if (shown.key === 'attend') {
    panel = reviewing ? <PostEventAttendReview registration={myRegistration} /> : <PostEventAttendPending />;
  } else if (shown.key === 'survey') {
    if (reviewing) {
      panel = (
        <PostEventSurveyReview
          surveyId={feedbackSurveyId}
          hasHonorarium={hasHonorarium}
          paymentInfoConfirmed={facts.paymentInfoConfirmed}
        />
      );
    } else if (!surveyOpen) {
      panel = (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {hasHonorarium
              ? 'Answer a few questions about the session. When you continue, your answers are saved and you move on to confirm your payment info. Answers cannot be changed after that.'
              : 'Answer a few questions about the session. Answers cannot be changed after you submit.'}
          </p>
          <button
            type="button"
            onClick={startSurvey}
            className="inline-flex rounded-[6px] bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            Start survey
          </button>
        </div>
      );
    } else {
      panel = (
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
          feedbackSurveyId={feedbackSurveyId}
          betweenAckHelpAndButton={
            surveySubmitted && !nativePostEventSurvey && !hasSurveyDraft ? null : program.feedbackSurveyId ? (
              <ProgramSurveyPanel
                surveyId={program.feedbackSurveyId}
                userId={userId}
                programId={program.id}
                authenticated
                userSummary={userSummary}
                hideSubmitButton={nativePostEventSurvey}
                formId={nativePostEventSurvey ? POST_EVENT_NATIVE_FORM_ID : undefined}
                submitAsDraft={nativePostEventSurvey && hasHonorarium}
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
                  finishSurvey();
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No native post-event survey is configured for this session yet.
              </p>
            )
          }
          onSurveyAcknowledged={finishSurvey}
        />
      );
    }
  } else if (shown.key === 'payment') {
    panel = reviewing ? (
      <PostEventPaymentReview registration={myRegistration} />
    ) : (
      <PostEventFeedbackLearnerActions
        programId={program.id}
        userId={userId}
        myRegistration={myRegistration}
        hasHonorarium={hasHonorarium}
        surveyReadyForAck={false}
        payoutStepOnly
        nativeSurveyMode={nativePostEventSurvey}
        feedbackSurveyId={feedbackSurveyId}
        onHonorariumRequestSubmitted={() => {
          focusOnStepChange.current = true;
          setLocalPaymentDone(true);
          setViewingKey(null);
        }}
      />
    );
  } else {
    panel = <PostEventConfirmation registration={myRegistration} hasHonorarium={hasHonorarium} />;
  }

  return (
    <section ref={sectionRef} className="scroll-mt-24" aria-labelledby="post-event-steps-heading">
      <h2 id="post-event-steps-heading" className="sr-only">
        Post-event steps
      </h2>
      <PostEventHero
        progress={progress}
        copy={postEventHeroCopy(progress, facts, { surveyStarted: surveyOpen })}
        onOpen={openWizard}
      />
      <PostEventDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        labelledBy="post-event-wizard-title"
        initialFocusRef={headingRef}
      >
        <PostEventWizard
          progress={progress}
          shown={shown}
          reviewing={reviewing}
          titleId="post-event-wizard-title"
          headingRef={headingRef}
          onSelect={selectStep}
          onClose={() => setDrawerOpen(false)}
        >
          {panel}
        </PostEventWizard>
      </PostEventDrawer>
    </section>
  );
}
