import type { ReactNode } from 'react';

/**
 * The frame every auth screen shares: the form on one side and a panel
 * on the other, collapsing to the form alone below lg.
 *
 * Sign-in is a single-task screen, so the panel carries a reason to be
 * here rather than a testimonial. A quote attributed to a clinician who
 * did not say it is a fabricated endorsement.
 */
export function AuthLayout({
  heading,
  sub,
  children,
  footer,
  welcome = 'Welcome back to the library.',
}: {
  heading: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** The line in the panel. Sign-in welcomes back; sign-up welcomes in. */
  welcome?: string;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] bg-background lg:grid-cols-2">
      <div className="flex flex-col justify-start px-5 pb-12 pt-8 sm:px-10 sm:pt-10 lg:px-14 lg:pt-14 xl:px-20">
        <div className="mx-auto w-full max-w-[26rem]">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {heading}
          </h1>
          {sub && <p className="mt-3 text-muted-foreground">{sub}</p>}

          {children}

          {footer && <div className="mt-8 text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-card lg:block">
        <img
          src="/images/home-hero-brand-auditorium.png"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(150deg, hsl(var(--cerebral-blue-deep) / 0.66) 0%, hsl(var(--cerebral-blue) / 0.3) 46%, hsl(var(--cerebral-pink) / 0.3) 100%)',
          }}
        />
        {/* Centred in the frame, and a welcome rather than a feature
            list: the panel's job on a sign-in screen is to say who this
            is for, not to sell the product to someone already signing
            in. Permanently over imagery, so the type is fixed white. */}
        <div className="absolute inset-0 flex items-center justify-center p-10 xl:p-14">
          <div className="max-w-[24rem] text-center">
            <p className="text-label uppercase text-white/70">Community Health Media</p>
            <p className="mt-4 text-[1.75rem] font-medium leading-[1.15] tracking-[-0.02em] text-white">
              {welcome}
            </p>
            <p className="mt-4 text-[0.9375rem] leading-relaxed text-white/75">
              Peer-led oncology education, organised the way clinicians actually work.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
