import { useId } from 'react';
import { AlertTriangle, Check, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { derivePayoutSetup, joinPlain, type PayoutAccountStatus } from '../../utils/payout-setup';

const PILL: Record<string, string> = {
  ready: 'border-success/30 bg-success/10 text-success',
  verifying: 'border-border bg-muted text-foreground',
  in_progress: 'border-warning/30 bg-warning/10 text-warning',
  not_started: 'border-border bg-muted text-muted-foreground',
};

/**
 * Short 1-2-3 guide above the embedded Stripe form (SCRUM-281). Every line is driven by the
 * live account status, so it says plainly whether setup is finished and what Stripe still needs.
 */
export function PayoutSetupGuide(props: {
  status: PayoutAccountStatus | null | undefined;
  /** True after the learner closed the Stripe form in this visit. */
  leftStripe?: boolean;
  checking?: boolean;
  onCheckAgain?: () => void;
}) {
  const { status, leftStripe = false, checking = false, onCheckAgain } = props;
  const setup = derivePayoutSetup(status);
  const titleId = useId();
  const PillIcon =
    setup.phase === 'ready' ? CheckCircle2 : setup.phase === 'verifying' ? Clock3 : AlertTriangle;

  return (
    <section aria-labelledby={titleId} className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="text-sm font-semibold text-foreground">
          {setup.phase === 'ready' ? 'Payout setup' : 'Get paid in 3 steps'}
        </h3>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${PILL[setup.phase]}`}
        >
          <PillIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {setup.statusLabel}
        </span>
      </div>

      {setup.phase === 'ready' ? (
        <p className="text-sm text-muted-foreground">
          Setup is finished. Use the Stripe form below only if you need to update your bank or tax details.
        </p>
      ) : (
        <ol className="grid gap-2 sm:grid-cols-3">
          {setup.steps.map((step) => {
            const isNext = setup.next === step.key;
            return (
              <li
                key={step.key}
                aria-current={isNext ? 'step' : undefined}
                className={[
                  'flex gap-3 rounded-[6px] border px-3 py-2.5',
                  isNext ? 'border-foreground/30 bg-muted' : 'border-border',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    step.done
                      ? 'bg-success text-card'
                      : isNext
                        ? 'bg-foreground text-card'
                        : 'border border-border text-muted-foreground',
                  ].join(' ')}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step.number}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
                    <span className="sr-only">{`Step ${step.number}:`}</span> {step.title}
                    {step.done ? <span className="sr-only">, done</span> : null}
                    {isNext ? (
                      <span className="rounded-full bg-foreground px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-card">
                        Next
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{step.body}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {leftStripe && setup.phase !== 'ready' ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-[6px] border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="inline-flex items-start gap-2 text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>
              {setup.phase === 'verifying' ? (
                <>
                  <strong className="font-semibold">Almost there.</strong> Stripe is checking your details. This
                  usually takes a few minutes.
                </>
              ) : (
                <>
                  <strong className="font-semibold">Setup is not finished yet.</strong> Stripe still needs your{' '}
                  {joinPlain(setup.missing)}. Use the Stripe form below to pick up where you left off.
                </>
              )}
            </span>
          </p>
          {onCheckAgain ? (
            <button
              type="button"
              onClick={onCheckAgain}
              disabled={checking}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {checking ? 'Checking…' : 'Check again'}
            </button>
          ) : null}
        </div>
      ) : null}

      <details className="group text-sm">
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
