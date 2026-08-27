import { StripeService } from './stripe.service';
import type Stripe from 'stripe';

describe('StripeService.summarizeAccount taxComplete (PAY-4)', () => {
  const service = new StripeService({
    get: () => undefined,
  } as never);

  const base = (overrides: Partial<Stripe.Account> = {}): Stripe.Account =>
    ({
      id: 'acct_test',
      object: 'account',
      payouts_enabled: false,
      details_submitted: false,
      charges_enabled: false,
      requirements: { currently_due: [], past_due: [], eventually_due: [] },
      external_accounts: { data: [], object: 'list', has_more: false, url: '' },
      ...overrides,
    }) as unknown as Stripe.Account;

  it('is false when tax id still currently due', () => {
    const summary = service.summarizeAccount(
      base({
        details_submitted: true,
        requirements: {
          currently_due: ['individual.id_number'],
          past_due: [],
          eventually_due: [],
        } as unknown as Stripe.Account.Requirements,
      }),
    );
    expect(summary.taxComplete).toBe(false);
  });

  it('is true when details submitted, no tax outstanding, payouts enabled', () => {
    const summary = service.summarizeAccount(
      base({
        details_submitted: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          past_due: [],
          eventually_due: [],
        } as unknown as Stripe.Account.Requirements,
      }),
    );
    expect(summary.taxComplete).toBe(true);
    expect(summary.status).toBe('active');
  });

  it('is false when past_due includes SSN even if currently_due empty', () => {
    const summary = service.summarizeAccount(
      base({
        details_submitted: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          past_due: ['individual.ssn_last_4'],
          eventually_due: [],
        } as unknown as Stripe.Account.Requirements,
      }),
    );
    expect(summary.taxComplete).toBe(false);
  });

  it('is false when details not submitted', () => {
    const summary = service.summarizeAccount(
      base({
        details_submitted: false,
        payouts_enabled: false,
        requirements: {
          currently_due: [],
          past_due: [],
          eventually_due: [],
        } as unknown as Stripe.Account.Requirements,
      }),
    );
    expect(summary.taxComplete).toBe(false);
  });
});
