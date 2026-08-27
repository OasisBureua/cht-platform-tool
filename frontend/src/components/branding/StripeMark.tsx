import { useState } from 'react';

/**
 * Stripe wordmark for inline UI (Connect payouts).
 * Asset: frontend/public/images/stripe-logo.svg
 * Replace with the official logo from https://stripe.com/newsroom/brand-assets when available.
 */
const LOGO_SRC = '/images/stripe-logo.svg';

const HEIGHT_PX: Record<'xs' | 'sm' | 'md' | 'lg', number> = {
  xs: 14,
  sm: 17,
  md: 21,
  lg: 26,
};

export function StripeMark({
  size = 'sm',
  className = '',
}: {
  size?: keyof typeof HEIGHT_PX;
  className?: string;
}) {
  const h = HEIGHT_PX[size];
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`inline-block font-semibold tracking-tight text-[#635BFF] align-middle ${className}`}
        style={{ fontSize: h * 0.85, lineHeight: 1 }}
      >
        Stripe
      </span>
    );
  }

  return (
    <img
      src={LOGO_SRC}
      alt="Stripe"
      className={`inline-block w-auto max-w-[min(9rem,100%)] object-contain align-middle ${className}`}
      style={{ height: h }}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
