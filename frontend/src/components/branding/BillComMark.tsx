/**
 * Bill wordmark for inline UI (vendor payouts). Asset:
 *   frontend/public/images/bill-com-logo.svg
 */
const LOGO_SRC = '/images/bill-com-logo.svg';

const HEIGHT_PX: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 14,
  sm: 17,
  md: 21,
  lg: 26,
};

export function BillComMark({
  size = 'sm',
  className = '',
}: {
  size?: keyof typeof HEIGHT_PX;
  className?: string;
}) {
  const h = HEIGHT_PX[size];
  return (
    <img
      src={LOGO_SRC}
      alt="Bill.com"
      className={`inline-block w-auto max-w-[min(9rem,100%)] object-contain align-middle ${className}`}
      style={{ height: h }}
      loading="lazy"
      decoding="async"
    />
  );
}
