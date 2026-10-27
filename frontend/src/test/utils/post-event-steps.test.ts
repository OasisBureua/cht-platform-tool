import { describe, it, expect } from 'vitest';
import {
  derivePostEventProgress,
  isPostEventStepSelectable,
  parsePostEventStepKey,
  postEventFactsFromRegistration,
  type PostEventProgressFacts,
} from '../../utils/post-event-steps';

const base: PostEventProgressFacts = {
  hasSurvey: true,
  hasHonorarium: true,
  nativeSurvey: true,
  attendance: 'VERIFIED',
  surveyAcknowledged: false,
  surveySubmitted: false,
  surveyDraftSaved: false,
  paymentInfoConfirmed: false,
  paymentStatus: null,
  payoutReady: undefined,
};

const states = (f: Partial<PostEventProgressFacts>) =>
  derivePostEventProgress({ ...base, ...f }).steps.map((s) => `${s.key}:${s.state}`);

describe('derivePostEventProgress', () => {
  it('builds the four-step map for a paid session with a survey', () => {
    const p = derivePostEventProgress(base);
    expect(p.steps.map((s) => [s.number, s.label])).toEqual([
      [1, 'Attend'],
      [2, 'Survey'],
      [3, 'Payment info'],
      [4, 'Done'],
    ]);
  });

  it('completes step 1 from recorded attendance and starts at the survey', () => {
    expect(states({})).toEqual([
      'attend:complete',
      'survey:current',
      'payment:not_started',
      'done:not_started',
    ]);
    expect(derivePostEventProgress(base).active.key).toBe('survey');
  });

  it('treats attendance that is not required as recorded', () => {
    expect(states({ attendance: 'NOT_REQUIRED' })[0]).toBe('attend:complete');
  });

  it('keeps step 1 current while attendance is still being verified', () => {
    expect(states({ attendance: 'PENDING_VERIFICATION' })).toEqual([
      'attend:current',
      'survey:not_started',
      'payment:not_started',
      'done:not_started',
    ]);
  });

  it('marks a denied attendee as not eligible for the flow', () => {
    const p = derivePostEventProgress({ ...base, attendance: 'DENIED' });
    expect(p.attendee).toBe(false);
    expect(p.active.key).toBe('attend');
    expect(p.active.state).toBe('attention');
  });

  it('moves to payment info once the survey draft is saved (steps 1 and 2 complete)', () => {
    expect(states({ surveyDraftSaved: true })).toEqual([
      'attend:complete',
      'survey:complete',
      'payment:current',
      'done:not_started',
    ]);
  });

  it('flags payment info when payout details are missing', () => {
    const p = derivePostEventProgress({ ...base, surveyDraftSaved: true, payoutReady: false });
    expect(p.active.key).toBe('payment');
    expect(p.active.state).toBe('attention');
    expect(p.active.helper).toMatch(/Payment details missing/);
  });

  it('does not flag a payment step that has not been reached yet', () => {
    expect(states({ payoutReady: false })[2]).toBe('payment:not_started');
  });

  it('shows step 4 as soon as payment info is confirmed, with a pending status line', () => {
    const p = derivePostEventProgress({
      ...base,
      surveySubmitted: true,
      paymentInfoConfirmed: true,
      paymentStatus: 'PENDING',
    });
    expect(p.steps.map((s) => s.state)).toEqual(['complete', 'complete', 'complete', 'current']);
    expect(p.active.key).toBe('done');
    expect(p.active.helper).toBe('Payment requested. It is typically sent within 14 calendar days.');
    expect(p.allComplete).toBe(false);
  });

  it('completes the map when the honorarium is paid', () => {
    const p = derivePostEventProgress({
      ...base,
      paymentInfoConfirmed: true,
      paymentStatus: 'PAID',
    });
    expect(p.allComplete).toBe(true);
    expect(p.active.key).toBe('done');
    expect(p.active.state).toBe('complete');
  });

  it('flags step 4 when the payment failed', () => {
    const p = derivePostEventProgress({ ...base, paymentInfoConfirmed: true, paymentStatus: 'FAILED' });
    expect(p.active.state).toBe('attention');
  });

  it('requires an acknowledge for Jotform surveys even after the form was submitted', () => {
    expect(states({ nativeSurvey: false, surveySubmitted: true })[1]).toBe('survey:current');
    expect(states({ nativeSurvey: false, surveyAcknowledged: true })[1]).toBe('survey:complete');
  });

  it('drops the payment step for sessions without an honorarium', () => {
    const p = derivePostEventProgress({ ...base, hasHonorarium: false });
    expect(p.steps.map((s) => s.label)).toEqual(['Attend', 'Survey', 'Done']);
    const finished = derivePostEventProgress({ ...base, hasHonorarium: false, surveySubmitted: true });
    expect(finished.allComplete).toBe(true);
    expect(finished.active.helper).toBe('Thank you. Your survey is recorded.');
  });

  it('a draft alone does not finish the survey for sessions without an honorarium', () => {
    expect(states({ hasHonorarium: false, surveyDraftSaved: true })[1]).toBe('survey:current');
  });

  it('drops the survey step when the session has no survey', () => {
    const p = derivePostEventProgress({ ...base, hasSurvey: false });
    expect(p.steps.map((s) => `${s.number}:${s.label}`)).toEqual(['1:Attend', '2:Payment info', '3:Done']);
    expect(p.active.key).toBe('payment');
  });
});

describe('postEventFactsFromRegistration', () => {
  it('reads payment confirmation from any of the registration signals', () => {
    const facts = postEventFactsFromRegistration({
      registration: {
        id: 'r',
        status: 'APPROVED',
        createdAt: '2026-10-01T00:00:00.000Z',
        postEventAttendanceStatus: 'VERIFIED',
        honorariumPayment: { id: 'p', status: 'PROCESSING' },
      },
      hasSurvey: true,
      hasHonorarium: true,
      nativeSurvey: true,
    });
    expect(facts.paymentInfoConfirmed).toBe(true);
    expect(facts.paymentStatus).toBe('PROCESSING');
    expect(derivePostEventProgress(facts).active.helper).toBe('Your payment is on its way to your bank.');
  });
});

describe('step helpers', () => {
  it('only lets done and in-progress steps be opened', () => {
    const p = derivePostEventProgress(base);
    expect(p.steps.map(isPostEventStepSelectable)).toEqual([true, true, false, false]);
  });

  it('parses step keys from the URL', () => {
    expect(parsePostEventStepKey('survey')).toBe('survey');
    expect(parsePostEventStepKey('nope')).toBeNull();
    expect(parsePostEventStepKey(null)).toBeNull();
  });
});
