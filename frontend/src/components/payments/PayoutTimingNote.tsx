import { StripeMark } from '../branding/StripeMark';
import { PAYOUT_WINDOW_LABEL } from '../../utils/payout-timing';

/** Shared HCP copy: when payouts land after request submission. */
export function PayoutTimingNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-pretty text-sm text-muted-foreground ${className}`.trim()}>
      Payouts are typically sent within <strong className="font-semibold text-foreground">{PAYOUT_WINDOW_LABEL}</strong>{' '}
      after your payment request is submitted, via <StripeMark size="xs" className="translate-y-px" /> ACH once your
      bank and tax details are connected.
    </p>
  );
}
