import type {
  PostEventAttendanceStatus,
  PostEventProgressItem,
  ProgramRegistrationState,
} from '../api/programs';
import { PAYOUT_WINDOW_LABEL } from './payout-timing';

/**
 * Post-event step map (SCRUM-288): attend, survey, payment info, done.
 *
 * Every state here comes from server data (attendance, survey response, payout
 * confirmation, honorarium payment), never from the page the learner is on, so the
 * program page, the Surveys tab and the dashboard card always agree and a returning
 * learner resumes at the first step that is not complete.
 */
export type PostEventStepKey = 'attend' | 'survey' | 'payment' | 'done';

export type PostEventStepState = 'not_started' | 'current' | 'complete' | 'attention';

export type PostEventStep = {
  key: PostEventStepKey;
  /** 1-based position in this learner's map (programs without a survey or honorarium have fewer steps). */
  number: number;
  /** Short label for the map ("Survey", "Payment info", "Done"). */
  label: string;
  /** Full step name for headings and screen readers. */
  title: string;
  state: PostEventStepState;
  /** One line of plain guidance; shown under the active step. */
  helper: string;
};

export type PostEventProgressFacts = {
  hasSurvey: boolean;
  hasHonorarium: boolean;
  /** In-app survey: a final submit completes the step without a separate acknowledge. */
  nativeSurvey: boolean;
  attendance?: PostEventAttendanceStatus | null;
  surveyAcknowledged: boolean;
  /** A final (non-draft) survey response is on file. */
  surveySubmitted: boolean;
  /** Survey answers are saved as a draft (honorarium flow finalizes them with the payment step). */
  surveyDraftSaved: boolean;
  /** Payout details confirmed or the honorarium request is on file. */
  paymentInfoConfirmed: boolean;
  /** Latest honorarium payment status (PENDING, PROCESSING, PAID, FAILED, CANCELLED). */
  paymentStatus?: string | null;
  /** Stripe payout readiness; undefined while unknown. */
  payoutReady?: boolean | null;
};

export type PostEventProgress = {
  /** False when attendance was denied: the flow applies to attendees only. */
  attendee: boolean;
  steps: PostEventStep[];
  /** The step to work on: the first one that is not complete, or the last step when everything is done. */
  active: PostEventStep;
  allComplete: boolean;
};

const LABELS: Record<PostEventStepKey, string> = {
  attend: 'Attend',
  survey: 'Survey',
  payment: 'Payment info',
  done: 'Done',
};

export function attendanceRecorded(att?: PostEventAttendanceStatus | null): boolean {
  return att === 'VERIFIED' || att === 'NOT_REQUIRED';
}

function doneHelper(f: PostEventProgressFacts): string {
  if (!f.hasHonorarium) return 'Thank you. Your survey is recorded.';
  switch (f.paymentStatus) {
    case 'PAID':
      return 'Your honorarium has been paid.';
    case 'PROCESSING':
      return 'Your payment is on its way to your bank.';
    case 'FAILED':
      return 'We could not send your payment. Check your payout details on the Payments page.';
    case 'CANCELLED':
      return 'This payment was cancelled. Contact support if you have questions.';
    default:
      return `Payment requested. It is typically sent within ${PAYOUT_WINDOW_LABEL}.`;
  }
}

export function derivePostEventProgress(f: PostEventProgressFacts): PostEventProgress {
  const attendee = f.attendance !== 'DENIED';
  const attendDone = attendanceRecorded(f.attendance);
  const surveyDone =
    f.paymentInfoConfirmed ||
    f.surveyAcknowledged ||
    (f.nativeSurvey && (f.surveySubmitted || (f.hasHonorarium && f.surveyDraftSaved)));
  const paymentDone = f.paymentInfoConfirmed;
  const doneDone = f.hasHonorarium ? f.paymentStatus === 'PAID' : surveyDone;
  const paymentProblem = f.paymentStatus === 'FAILED' || f.paymentStatus === 'CANCELLED';

  type Draft = { key: PostEventStepKey; title: string; complete: boolean; attention: boolean; helper: string };
  const drafts: Draft[] = [
    {
      key: 'attend',
      title: 'Attend the session',
      complete: attendDone,
      attention: !attendee,
      helper: attendee
        ? 'Attendance is recorded automatically after the session ends.'
        : 'We could not confirm your attendance for this session.',
    },
  ];
  if (f.hasSurvey) {
    drafts.push({
      key: 'survey',
      title: 'Complete the survey',
      complete: surveyDone,
      attention: false,
      helper: f.hasHonorarium
        ? 'Answer a few questions about the session. Payment info comes next.'
        : 'Answer a few questions about the session.',
    });
  }
  if (f.hasHonorarium) {
    drafts.push({
      key: 'payment',
      title: 'Confirm payment information',
      complete: paymentDone,
      attention: f.payoutReady === false,
      helper:
        f.payoutReady === false
          ? 'Payment details missing. Finish your Stripe payout setup to continue.'
          : 'Check where we should send your honorarium, then confirm.',
    });
  }
  drafts.push({
    key: 'done',
    title: f.hasHonorarium ? 'Confirmation and payment timing' : 'Confirmation',
    complete: doneDone,
    attention: f.hasHonorarium && paymentProblem,
    helper: doneHelper(f),
  });

  const firstOpen = drafts.findIndex((d) => !d.complete);
  const activeIndex = firstOpen === -1 ? drafts.length - 1 : firstOpen;

  const steps: PostEventStep[] = drafts.map((d, i) => {
    let state: PostEventStepState;
    if (d.complete) state = 'complete';
    else if (i === activeIndex) state = d.attention ? 'attention' : 'current';
    else state = 'not_started';
    return { key: d.key, number: i + 1, label: LABELS[d.key], title: d.title, state, helper: d.helper };
  });

  return { attendee, steps, active: steps[activeIndex], allComplete: firstOpen === -1 };
}

/** Facts from the learner's registration row (program page and Surveys tab). */
export function postEventFactsFromRegistration(input: {
  registration: ProgramRegistrationState | null | undefined;
  hasSurvey: boolean;
  hasHonorarium: boolean;
  nativeSurvey: boolean;
  surveyDraftSaved?: boolean;
  payoutReady?: boolean | null;
}): PostEventProgressFacts {
  const reg = input.registration;
  return {
    hasSurvey: input.hasSurvey,
    hasHonorarium: input.hasHonorarium,
    nativeSurvey: input.nativeSurvey,
    attendance: reg?.postEventAttendanceStatus ?? null,
    surveyAcknowledged: !!reg?.postEventSurveyAcknowledgedAt,
    surveySubmitted: !!reg?.postEventSurveySubmitted,
    surveyDraftSaved: !!input.surveyDraftSaved,
    paymentInfoConfirmed: !!(
      reg?.honorariumRequestedAt ||
      reg?.payoutDetailsConfirmedAt ||
      reg?.honorariumPayment
    ),
    paymentStatus: reg?.honorariumPayment?.status ?? null,
    payoutReady: input.payoutReady,
  };
}

/** Facts from a dashboard row (GET /programs/me/post-event-progress). */
export function postEventFactsFromProgressItem(item: PostEventProgressItem): PostEventProgressFacts {
  return {
    hasSurvey: item.hasSurvey,
    hasHonorarium: item.hasHonorarium,
    nativeSurvey: item.nativeSurvey,
    attendance: item.attendance,
    surveyAcknowledged: item.surveyAcknowledged,
    surveySubmitted: item.surveySubmitted,
    surveyDraftSaved: item.surveyDraftSaved,
    paymentInfoConfirmed: item.paymentInfoConfirmed,
    paymentStatus: item.paymentStatus,
    payoutReady: item.payoutReady,
  };
}

/** Program page for a live session, where the post-event steps are completed. */
export function postEventProgramPath(programId: string, zoomSessionType?: 'WEBINAR' | 'MEETING' | null): string {
  const base = zoomSessionType === 'MEETING' ? '/app/office-hours' : '/app/live';
  return `${base}/${encodeURIComponent(programId)}`;
}

/** True when a step can be opened from the map: done steps (to review) and the step in progress. */
export function isPostEventStepSelectable(step: PostEventStep): boolean {
  return step.state !== 'not_started';
}

export function parsePostEventStepKey(raw: string | null | undefined): PostEventStepKey | null {
  return raw === 'attend' || raw === 'survey' || raw === 'payment' || raw === 'done' ? raw : null;
}

export type PostEventHeroCopy = {
  eyebrow: string;
  title: string;
  helper: string;
  /** Null when there is nothing for the learner to do yet (attendance still being verified). */
  cta: string | null;
};

/** Words for the post-event hero: what to do next, from the same derived progress as the step map. */
export function postEventHeroCopy(
  progress: PostEventProgress,
  facts: Pick<PostEventProgressFacts, 'hasHonorarium' | 'paymentStatus'>,
  opts: { surveyStarted: boolean },
): PostEventHeroCopy {
  const step = progress.active;
  const next = facts.hasHonorarium ? 'Next step to get paid' : 'Next step';
  switch (step.key) {
    case 'attend':
      return { eyebrow: 'After the session', title: 'We are confirming your attendance', helper: step.helper, cta: null };
    case 'survey':
      return { eyebrow: next, title: 'Complete the survey', helper: step.helper, cta: opts.surveyStarted ? 'Continue the survey' : 'Start the survey' };
    case 'payment':
      return {
        eyebrow: next,
        title: 'Confirm payment information',
        helper: step.helper,
        cta: step.state === 'attention' ? 'Set up payouts' : 'Confirm payment info',
      };
    default:
      break;
  }
  if (!facts.hasHonorarium) {
    return { eyebrow: 'All done', title: 'Thank you for your feedback', helper: step.helper, cta: 'View details' };
  }
  switch (facts.paymentStatus) {
    case 'PAID':
      return { eyebrow: 'All done', title: 'Your honorarium has been paid', helper: step.helper, cta: 'View details' };
    case 'PROCESSING':
      return { eyebrow: 'Payment requested', title: 'Your payment is on its way', helper: step.helper, cta: 'View payment status' };
    case 'FAILED':
      return { eyebrow: 'Needs attention', title: 'There is a problem with your payment', helper: step.helper, cta: 'View payment status' };
    case 'CANCELLED':
      return { eyebrow: 'Payment cancelled', title: 'This payment was cancelled', helper: step.helper, cta: 'View payment status' };
    default:
      return { eyebrow: 'Payment requested', title: 'Your honorarium is requested', helper: step.helper, cta: 'View payment status' };
  }
}
