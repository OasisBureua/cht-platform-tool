import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock3, Landmark, Loader2, Plus, X } from 'lucide-react';
import { StripeMark } from '../branding/StripeMark';
import { derivePayoutSetup, joinPlain, type PayoutAccountStatus, type PayoutSetup } from '../../utils/payout-setup';

/** Fixed light-theme brand teal so the white type on the ready card keeps its contrast in dark mode. */
const READY_GRADIENT = 'bg-[linear-gradient(135deg,hsl(193_63%_28%)_0%,hsl(193_63%_40%)_100%)]';

const STEP_LABELS = ['Open the Stripe form', 'Add name, bank and tax info', 'Ready for payouts'];

const BADGE: Record<PayoutSetup['phase'], { label: string; cls: string }> = {
  not_started: { label: 'Not set up', cls: 'bg-muted text-muted-foreground ring-border' },
  in_progress: { label: 'Not finished', cls: 'bg-orange-50 text-amber ring-orange-200' },
  verifying: { label: 'Checking', cls: 'bg-cta/10 text-anchor ring-cta/25' },
  ready: { label: 'Ready', cls: 'bg-white/20 text-white ring-white/30' },
};

/**
 * The payout account as a card that fills in as setup progresses (SCRUM-281). Same anatomy in
 * every state (bank tile, status, account number, holder, Stripe) so it reads as one object:
 * dashed and empty, then a chip per detail Stripe still needs, then teal with the last 4 digits.
 */
export function BankCardVisual({
  setup,
  last4,
  holderName,
}: {
  setup: PayoutSetup;
  last4?: string | null;
  holderName?: string | null;
}) {
  const ready = setup.phase === 'ready';
  const started = setup.phase !== 'not_started';
  const badge = BADGE[setup.phase];
  const BadgeIcon = ready ? CheckCircle2 : setup.phase === 'verifying' ? Clock3 : setup.phase === 'in_progress' ? AlertTriangle : null;
  const chips: Array<[string, boolean]> = [
    ['Name and address', !setup.missing.includes('personal details')],
    ['Bank account', !setup.missing.includes('bank account')],
    ['Tax info (W-9)', !setup.missing.includes('tax info (W-9)')],
  ];
  const ink = ready ? 'text-white' : 'text-foreground';
  const soft = ready ? 'text-white/80' : 'text-muted-foreground';

  return (
    <div
      className={[
        'relative isolate flex aspect-[1.586] w-full flex-col justify-between overflow-hidden rounded-[18px] p-4 sm:p-5',
        ready
          ? `${READY_GRADIENT} text-white shadow-[0_18px_40px_-18px_rgba(18,78,96,0.75)]`
          : started
            ? 'bg-cta/[0.06] ring-1 ring-cta/25'
            : 'border-2 border-dashed border-border bg-muted/30',
      ].join(' ')}
    >
      {/* Texture: a fine dot grid, plus soft light shapes on the finished card. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 -z-10 ${ready ? 'opacity-[0.14]' : 'opacity-[0.5]'}`}
        style={{
          backgroundImage: `radial-gradient(${ready ? '#fff' : 'hsl(var(--border))'} 1px, transparent 1px)`,
          backgroundSize: '14px 14px',
        }}
      />
      {ready ? (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-14 -top-20 -z-10 h-56 w-56 rounded-full bg-white/10" />
          <span aria-hidden className="pointer-events-none absolute -bottom-28 -left-12 -z-10 h-56 w-56 rounded-full bg-black/10" />
        </>
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] ${
              ready ? 'bg-white/15 ring-1 ring-white/25' : 'bg-card text-anchor ring-1 ring-border'
            }`}
          >
            <Landmark className="h-[18px] w-[18px]" />
          </span>
          <span className="leading-tight">
            <span className={`block text-[11px] font-semibold uppercase tracking-wide ${soft}`}>Direct deposit</span>
            <span className={`block text-xs font-semibold ${ink}`}>ACH bank transfer</span>
          </span>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${badge.cls}`}>
          {BadgeIcon ? <BadgeIcon className="h-3 w-3" aria-hidden /> : null}
          {badge.label}
        </span>
      </div>

      {setup.phase === 'in_progress' ? (
        <ul className="flex flex-wrap gap-1.5">
          {chips.map(([label, ok]) => (
            <li
              key={label}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                ok ? 'bg-success/10 text-success ring-success/20' : 'bg-card text-amber ring-orange-200'
              }`}
            >
              {ok ? <Check className="h-3 w-3" aria-hidden /> : <AlertTriangle className="h-3 w-3" aria-hidden />}
              {label}
              <span className="sr-only">{ok ? ', done' : ', still needed'}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className={`font-mono text-lg tracking-[0.18em] sm:text-xl ${started ? ink : 'text-muted-foreground/70'}`}>
            <span className="sr-only">{last4 ? `Bank account ending ${last4}` : 'No bank account yet'}</span>
            <span aria-hidden>•••• •••• {last4 ?? '----'}</span>
          </p>
          {!started ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-anchor">
              <Plus className="h-4 w-4" aria-hidden /> Add your bank account
            </p>
          ) : null}
        </div>
      )}

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 leading-tight">
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${soft}`}>Account holder</p>
          <p className={`truncate text-sm font-semibold ${holderName ? ink : soft}`}>{holderName || 'Your legal name'}</p>
        </div>
        <p className={`flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${soft}`}>
          via <StripeMark size="xs" className={ready ? 'brightness-0 invert' : ''} />
        </p>
      </div>
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
  /** Shown on the card; Stripe pays out to the legal name on file. */
  holderName?: string | null;
  formOpen: boolean;
  /** True after the learner closed the Stripe form in this visit without finishing. */
  leftStripe: boolean;
  checking: boolean;
  startTipVisible: boolean;
  onDismissStartTip: () => void;
  onPrimary: () => void;
  children?: ReactNode;
}) {
  const { status, holderName, formOpen, leftStripe, checking, startTipVisible, onDismissStartTip, onPrimary, children } = props;
  const setup = derivePayoutSetup(status);
  const copy = headlineFor(setup, status?.bankAccountLast4);
  const ready = setup.phase === 'ready';

  return (
    <section aria-label="Payout setup" className="space-y-5 rounded-card border border-border bg-card p-5 sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[minmax(0,300px)_1fr] sm:items-center">
        <div className="max-w-[340px]">
          <BankCardVisual setup={setup} last4={status?.bankAccountLast4} holderName={holderName} />
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
