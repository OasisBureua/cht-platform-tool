/**
 * Stripe payout setup progress for the in-app 1-2-3 guide (SCRUM-281).
 *
 * Beta users skipped setup or thought Stripe was connected when it was not, so the
 * guide always states, from the live account status, whether setup is finished and
 * what Stripe still needs.
 */
export type PayoutAccountStatus = {
  hasAccount?: boolean;
  detailsSubmitted?: boolean;
  payoutsEnabled?: boolean;
  w9Submitted?: boolean;
  bankAccountLast4?: string | null;
};

export type PayoutSetupPhase = 'not_started' | 'in_progress' | 'verifying' | 'ready';

export type PayoutSetupStepKey = 'open' | 'details' | 'ready';

export type PayoutSetupStep = {
  key: PayoutSetupStepKey;
  number: number;
  title: string;
  body: string;
  done: boolean;
};

export type PayoutSetup = {
  phase: PayoutSetupPhase;
  /** Short status for the pill next to the guide title. */
  statusLabel: string;
  steps: PayoutSetupStep[];
  /** First step that is not done; null when setup is finished. */
  next: PayoutSetupStepKey | null;
  /** What Stripe still needs from the learner, for "Stripe still needs your …". Empty while Stripe verifies. */
  missing: string[];
};

export function derivePayoutSetup(status: PayoutAccountStatus | null | undefined): PayoutSetup {
  const hasAccount = !!status?.hasAccount;
  const detailsSubmitted = !!status?.detailsSubmitted;
  const taxDone = !!status?.w9Submitted;
  const payoutsEnabled = !!status?.payoutsEnabled;

  const ready = payoutsEnabled && taxDone;
  const phase: PayoutSetupPhase = ready
    ? 'ready'
    : detailsSubmitted && taxDone
      ? 'verifying'
      : hasAccount
        ? 'in_progress'
        : 'not_started';

  const steps: PayoutSetupStep[] = [
    {
      key: 'open',
      number: 1,
      title: 'Open the Stripe form',
      body: 'Tap the button in the Stripe form below to begin.',
      done: hasAccount || detailsSubmitted || ready,
    },
    {
      key: 'details',
      number: 2,
      title: 'Add your details',
      body: 'Legal name, bank account and tax info (W-9). Keep going until Stripe says you are done.',
      done: (detailsSubmitted && taxDone) || ready,
    },
    {
      key: 'ready',
      number: 3,
      title: 'Check for "Ready for payouts"',
      body: 'This page says "Ready for payouts" when setup is finished. Closing Stripe early leaves it unfinished.',
      done: ready,
    },
  ];

  const missing: string[] = [];
  if (!ready && phase !== 'verifying') {
    if (!detailsSubmitted) missing.push('personal details', 'bank account');
    if (!taxDone) missing.push('tax info (W-9)');
  }

  const statusLabel = {
    not_started: 'Not set up',
    in_progress: 'Not finished',
    verifying: 'Stripe is checking your details',
    ready: 'Ready for payouts',
  }[phase];

  return { phase, statusLabel, steps, next: steps.find((s) => !s.done)?.key ?? null, missing };
}

/** "a, b and c" for short lists in sentences. */
export function joinPlain(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
