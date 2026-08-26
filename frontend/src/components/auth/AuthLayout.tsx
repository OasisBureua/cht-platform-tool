import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
}: {
  heading: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-[calc(100dvh-4rem)] bg-background lg:grid-cols-2">
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[26rem]">
          <Link
            to="/"
            aria-label="Home"
            className="-ms-2 mb-8 inline-block rounded-[6px] p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <img src="/logo.svg" alt="" className="h-8 w-auto" />
          </Link>

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
        <div className="absolute inset-x-10 bottom-12 xl:inset-x-14">
          <div className="rounded-card bg-card/90 p-5 shadow-card backdrop-blur-2xl backdrop-saturate-150">
            <p className="text-label uppercase text-muted-foreground">Peer-led education</p>
            <p className="mt-3 text-lg font-medium leading-snug text-foreground">
              Video, podcasts and editorial for oncology, organised by disease state
              and by format.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
