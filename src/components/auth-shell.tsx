import Link from "next/link";
import type { ReactNode } from "react";
import { byNewest, facultyBySlug, items } from "@/lib/data";
import { Mark } from "./mark";
import { ArrowLeft } from "./icons";

/**
 * Two panels: the form on one side, the thing you are signing in for on
 * the other. Below lg the panel drops away and the form takes the
 * screen on its own.
 *
 * The floating card shows a real session rather than a testimonial,
 * because a quote from a clinician who did not say it is a fabricated
 * endorsement, and the session is the more honest argument anyway.
 */
export function AuthShell({
  heading,
  sub,
  children,
  footer,
}: {
  heading: string;
  sub: string;
  children: ReactNode;
  footer: { prompt: string; label: string; href: string };
}) {
  const featured = byNewest(items).find((i) => i.format !== "editorial") ?? items[0];
  const lead = facultyBySlug(featured.faculty[0]);

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      {/* ── form ─────────────────────────────────────────── */}
      <div className="flex flex-col justify-center px-5 py-14 sm:px-10 lg:px-14 xl:px-20">
        <div className="mx-auto w-full max-w-[25rem]">
          <Link href="/" aria-label="CHM home" className="press -ms-2 block w-fit rounded-[6px] p-2">
            <Mark className="size-9 text-anchor" />
          </Link>

          <Link
            href="/"
            className="press mt-8 inline-flex w-fit items-center gap-1.5 rounded-[6px] py-1 text-body-s text-muted hover:text-text"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} />
            Back
          </Link>

          <h1 className="display display-tight mt-5 text-[2.125rem] leading-[1.08] text-text">
            {heading}
          </h1>
          <p className="prose-lede mt-3 text-body-m text-muted">{sub}</p>

          {children}

          <p className="mt-8 text-body-s text-muted">
            {footer.prompt}{" "}
            <Link href={footer.href} className="press rounded-[6px] text-anchor hover:brightness-110">
              {footer.label}
            </Link>
          </p>
        </div>
      </div>

      {/* ── panel ────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-surface lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/cells-warm.jpg" alt="" className="absolute inset-0 size-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(150deg, color-mix(in oklab, var(--color-blue-deep) 62%, transparent) 0%, color-mix(in oklab, var(--color-blue) 28%, transparent) 46%, color-mix(in oklab, var(--color-pink) 30%, transparent) 100%)",
          }}
        />

        <div className="absolute inset-x-10 bottom-12 xl:inset-x-14">
          <div className="rounded-[10px] bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] p-4 shadow-[var(--shadow-pop)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)] backdrop-blur-2xl backdrop-saturate-150">
            <p className="eyebrow text-faint">Latest on CHM</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="relative block h-16 w-28 shrink-0 overflow-hidden rounded-[6px] bg-ground">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featured.thumb} alt="" className="size-full object-cover" />
              </span>
              <span className="min-w-0">
                <span className="display line-clamp-2 block text-body-m text-text">
                  {featured.title}
                </span>
                <span className="meta mt-1 block text-faint">
                  {lead?.name} · {featured.duration}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
