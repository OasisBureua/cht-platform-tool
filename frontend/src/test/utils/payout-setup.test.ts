import { describe, it, expect } from 'vitest';
import { derivePayoutSetup, joinPlain } from '../../utils/payout-setup';

describe('derivePayoutSetup', () => {
  it('starts at step 1 when there is no Stripe account', () => {
    const s = derivePayoutSetup({ hasAccount: false });
    expect(s.phase).toBe('not_started');
    expect(s.statusLabel).toBe('Not set up');
    expect(s.next).toBe('open');
    expect(s.missing).toEqual(['personal details', 'bank account', 'tax info (W-9)']);
  });

  it('says "Not finished" when the account exists but Stripe still needs details', () => {
    const s = derivePayoutSetup({ hasAccount: true, detailsSubmitted: false, w9Submitted: false });
    expect(s.phase).toBe('in_progress');
    expect(s.statusLabel).toBe('Not finished');
    expect(s.steps.map((x) => x.done)).toEqual([true, false, false]);
    expect(s.next).toBe('details');
  });

  it('names only the tax info when that is all that is left', () => {
    const s = derivePayoutSetup({ hasAccount: true, detailsSubmitted: true, w9Submitted: false });
    expect(s.phase).toBe('in_progress');
    expect(s.missing).toEqual(['tax info (W-9)']);
  });

  it('waits on Stripe verification once details and tax info are in', () => {
    const s = derivePayoutSetup({ hasAccount: true, detailsSubmitted: true, w9Submitted: true, payoutsEnabled: false });
    expect(s.phase).toBe('verifying');
    expect(s.next).toBe('ready');
    expect(s.missing).toEqual([]);
  });

  it('is ready only when payouts are enabled and tax info is on file', () => {
    expect(derivePayoutSetup({ hasAccount: true, payoutsEnabled: true, w9Submitted: false }).phase).toBe(
      'in_progress',
    );
    const s = derivePayoutSetup({ hasAccount: true, detailsSubmitted: true, payoutsEnabled: true, w9Submitted: true });
    expect(s.phase).toBe('ready');
    expect(s.statusLabel).toBe('Ready for payouts');
    expect(s.next).toBeNull();
    expect(s.missing).toEqual([]);
  });

  it('treats a missing status as not set up', () => {
    expect(derivePayoutSetup(undefined).phase).toBe('not_started');
  });
});

describe('joinPlain', () => {
  it('joins lists the way people write them', () => {
    expect(joinPlain([])).toBe('');
    expect(joinPlain(['a'])).toBe('a');
    expect(joinPlain(['a', 'b'])).toBe('a and b');
    expect(joinPlain(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
