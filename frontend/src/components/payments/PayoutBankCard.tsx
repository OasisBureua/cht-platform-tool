import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Landmark, Loader2, Plus, X } from 'lucide-react';
import { derivePayoutSetup, joinPlain, type PayoutAccountStatus, type PayoutSetup } from '../../utils/payout-setup';

/** Fixed light-theme brand teal so the white type on the ready card keeps its contrast in dark mode. */
const READY_GRADIENT = 'bg-[linear-gradient(135deg,hsl(193_63%_28%)_0%,hsl(193_63%_40%)_100%)]';

const STEP_LABELS = ['Open the Stripe form', 'Add name, bank and tax info', 'Ready for payouts'];

/**
 * The payout account as a card that fills in as setup progresses (SCRUM-281): dashed when
 * empty, a chip per detail while Stripe still needs things, teal with the last 4 digits when ready.
 */
export function BankCardVisual({ setup, last4 }: { setup: PayoutSetup; last4?: string | null }) {
  if (setup.phase === 'ready') {
    return (
      <div
        className={`relative flex aspect-[1.6] w-full flex-col justify-between overflow-hidden rounded-[18px] p-5 text-white shadow-card ${READY_GRADIENT}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/90">Direct deposit</span>
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-mono text-xl tracking-[0.2em]">
            <span className="sr-only">Bank account ending </span>•••• {last4 ?? '••••'}
          </p>
          <p className="mt-1 text-sm text-white">Ready for payouts</p>
        </div>
      </div>
    );
  }
  const started = setup.phase !== 'not_started';
  const chips: Array<[string, boolean]> = [
    ['Name and address', !setup.missing.includes('personal details')],
    ['Bank account', !setup.missing.includes('bank account')],
    ['Tax info (W-9)', !setup.missing.includes('tax info (W-9)')],
  ];
  return (
    <div
      className={`flex aspect-[1.6] w-full flex-col justify-between rounded-[18px] p-5 ${
        started ? 'bg-cta/5 ring-1 ring-cta/25' : 'border-2 border-dashed border-border'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct deposit</span>
        <Landmark className="h-5 w-5 text-anchor" aria-hidden />
      </div>
      {started ? (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map(([label, ok]) => (
            <li
              key={label}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                ok ? 'bg-success/10 text-success ring-success/20' : 'bg-orange-50 text-amber ring-orange-200'
              }`}
            >
              {ok ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
              {label}
              <span className="sr-only">{ok ? ', done' : ', still needed'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-anchor">
          <Plus className="h-4 w-4" aria-hidden /> Add your bank account
        </p>
      )}
    </div>
  );
}

function SetupSteps({ setup }: { setup: PayoutSetup }) {
  return (
    <ol className="space-y-2.5">
      {setup.steps.map((s, i) => {
        const next = setup.next === s.key;
        return (
          <li key={s.key} aria-current={next ? 'step' : undefined} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={[
                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                s.done ? 'bg-success text-white' : next ? 'bg-anchor text-white ring-4 ring-cta/20' : 'bg-card text-muted-foreground ring-1 ring-border',
              ].join(' ')}
            >
              {s.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={`text-sm ${s.done ? 'text-foreground' : next ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
              <span className="sr-only">{`Step ${i + 1}${s.done ? ', done' : next ? ', next' : ''}: `}</span>
              {STEP_LABELS[i]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Teal tip bubble pointing down at what it describes. */
function Pointer({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div
      role="status"
      className="relative inline-flex max-w-[min(380px,100%)] items-start gap-2 rounded-[12px] bg-anchor px-3.5 py-2.5 text-sm text-white shadow-lg"
    >
      <span aria-hidden className="absolute -bottom-1.5 left-6 h-3 w-3 rotate-45 bg-anchor" />
      <span className="flex-1">{children}</span>
      {onClose ? (
        <button type="button" aria-label="Dismiss tip" onClick={onClose} className="-mr-1 rounded p-0.5 text-white/85 hover:text-white">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function headlineFor(setup: PayoutSetup, last4?: string | null) {
  switch (setup.phase) {
    case 'ready':
      return {
        headline: 'Ready for payouts',
        body: `Payments go to your bank account${last4 ? ` ending ${last4}` : ''}.`,
        action: 'Update bank or tax details',
      };
    case 'verifying':
      return {
        headline: 'Stripe is checking your details',
        body: 'This usually takes a few minutes. There is nothing else you need to do.',
        action: 'Check status',
      };
    case 'in_progress':
      return {
        headline: 'Almost there: setup is not finished',
        body: `Stripe still needs your ${joinPlain(setup.missing)}.`,
        action: 'Finish setup in Stripe',
      };
    default:
      return {
        headline: 'Get paid by direct deposit',
        body: 'Set up payouts with Stripe in 3 short steps. Have your bank details and tax ID (SSN or EIN) ready.',
        action: 'Set up payouts',
      };
  }
}

/**
 * Stripe payout setup as one flow (SCRUM-281): bank card, status, the 3 steps, one button and a
 * pointer. The embedded Stripe form (`children`) shows below the card once it is opened.
 */
export function PayoutBankCard(props: {
  status: PayoutAccountStatus | null | undefined;
  formOpen: boolean;
  /** True after the learner closed the Stripe form in this visit without finishing. */
  leftStripe: boolean;
  checking: boolean;
  startTipVisible: boolean;
  onDismissStartTip: () => void;
  onPrimary: () => void;
  children?: ReactNode;
}) {
  const { status, formOpen, leftStripe, checking, startTipVisible, onDismissStartTip, onPrimary, children } = props;
  const setup = derivePayoutSetup(status);
  const copy = headlineFor(setup, status?.bankAccountLast4);
  const ready = setup.phase === 'ready';

  return (
    <section aria-label="Payout setup" className="space-y-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,280px)_1fr] sm:items-center">
        <div className="max-w-[320px]">
          <BankCardVisual setup={setup} last4={status?.bankAccountLast4} />
        </div>
        <div className="space-y-3">
          <div role="status">
            <h3 className="display text-body-l text-text">{copy.headline}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
          </div>
          {!ready ? <SetupSteps setup={setup} /> : null}
          {leftStripe && !ready && !formOpen ? (
            <div>
              <Pointer>
                {setup.phase === 'verifying'
                  ? 'Thanks. Stripe has your details and is checking them now.'
                  : 'Pick up where you stopped. Stripe keeps what you already entered.'}
              </Pointer>
            </div>
          ) : null}
          {!formOpen ? (
            <div>
              <button
                type="button"
                onClick={onPrimary}
                disabled={checking}
                className={[
                  'inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] px-5 text-base font-semibold transition-transform duration-150 active:scale-[0.97] disabled:opacity-60 sm:w-auto',
                  ready
                    ? 'border border-border bg-card text-foreground hover:bg-muted'
                    : 'bg-anchor text-white shadow-card hover:bg-cta-deep',
                ].join(' ')}
              >
                {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {checking ? 'Checking…' : copy.action}
                {ready || checking ? null : <ArrowRight className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {formOpen ? (
        <div className="space-y-3">
          {startTipVisible ? (
            <div>
              <Pointer onClose={onDismissStartTip}>
                <strong className="font-semibold">Start here.</strong> Tap the button in the Stripe form and keep going
                until Stripe says you are done.
              </Pointer>
            </div>
          ) : null}
          {children}
        </div>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer select-none font-semibold text-foreground underline underline-offset-2">
          Why Stripe?
        </summary>
        <p className="mt-2 text-muted-foreground">
          Stripe is the payment service CHM uses to send honoraria by direct deposit (ACH). Paper checks are not
          available. Stripe keeps your bank and tax details; CHM only sees the last 4 digits of your account. Use your
          legal name or business name as it should appear on tax forms.
        </p>
      </details>
    </section>
  );
}
