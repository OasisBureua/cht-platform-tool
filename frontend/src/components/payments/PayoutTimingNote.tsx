import { StripeMark } from '../branding/StripeMark';

/** Shared HCP copy: payouts land ~14 calendar days after request submission. */
export function PayoutTimingNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-pretty text-sm text-muted-foreground ${className}`.trim()}>
      Payouts are typically sent within <strong className="font-semibold text-foreground">14 calendar days</strong>{' '}
      after your payment request is submitted, via <StripeMark size="xs" className="translate-y-px" /> ACH once your
      bank and tax details are connected.
    </p>
  );
}
