"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { diseaseAreas, shows } from "@/lib/platform";
import { Mark, Wordmark } from "./mark";
import { ArrowRight } from "./icons";

/* Routes mirror the live platform IA. The header and footer must
   describe the same site. */
const columns = [
  {
    label: "Content",
    links: [
      { href: "/catalog", label: "Content library" },
      { href: "/catalog?view=playlists", label: "Playlists" },
      { href: "/catalog?view=clips", label: "Clips" },
      { href: "/chm-office-hours", label: "CHM Office Hours" },
    ],
  },
  {
    label: "Disease states",
    links: diseaseAreas.map((d) => ({
      href: `/catalog/${d.slug === "lung" ? "lung-cancer" : "breast-cancer"}`,
      label: d.label,
    })),
  },
  {
    label: "Shows",
    links: shows.map((s) => ({ href: "/chm-office-hours", label: s.title })),
  },
  {
    label: "Company",
    links: [
      { href: "/about", label: "About CHM" },
      { href: "/kol-network", label: "KOL network" },
      { href: "/contact", label: "Contact the editorial team" },
    ],
  },
  {
    label: "Get started",
    links: [
      { href: "/for-hcps", label: "For HCPs" },
      { href: "/join", label: "Create an account" },
      { href: "/login", label: "Log in" },
    ],
  },
];

/* One colour per column, drawn from the brand spectrum. These are
   text, not fills, so they use the ink variants that deepen on a
   light ground instead of the bright ones that vanish on it. */
const COLUMN_INK = [
  "text-ink-cyan",
  "text-ink-pink",
  "text-ink-purple",
  "text-ink-coral",
  "text-ink-green",
];

/* Auth routes are single-task screens: one column, one thing to do.
   The chrome would only offer ways to leave it. */
const BARE = ["/login", "/join"];

export function SiteFooter() {
  const pathname = usePathname();
  if (BARE.includes(pathname)) return null;

  return (
    <>
      <section aria-labelledby="newsletter-heading">
        <div className="rail grid gap-8 py-14 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2 id="newsletter-heading" className="display text-display-m text-text">
              New sessions, every week
            </h2>
            <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted">
              One email. Faculty, formats, and what changed in the guidelines.
            </p>
          </div>

          <form action="/thanks" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label htmlFor="newsletter-email" className="mb-2 block text-body-s text-muted">
                Work email
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@hospital.org"
                className="h-11 w-full rounded-[6px] bg-surface px-5 text-base text-text shadow-[var(--shadow-card)] outline-none placeholder:text-faint focus:bg-ground sm:w-[19rem] sm:text-body-s"
              />
            </div>
            <button
              type="submit"
              className="press inline-flex h-11 shrink-0 items-center gap-2 rounded-[6px] bg-cta px-6 font-mono text-[0.875rem] tracking-[-0.011em] text-ground hover:bg-cta-deep"
            >
              Subscribe
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </button>
          </form>
        </div>
      </section>

      <footer>
        <div className="rail py-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_3fr]">
            <div>
              <Link
                href="/"
                className="press inline-block rounded-[6px] py-1 text-2xl text-text"
                aria-label="CHM, home"
              >
                <Wordmark markClassName="text-accent" />
              </Link>
              <p className="prose-lede mt-5 max-w-[28ch] text-body-s text-muted">
                Community Health Media. Peer-led oncology education, organised the way clinicians
                actually work.
              </p>
            </div>

            {/* One landmark for the whole footer: five separate nav
                landmarks turn landmark navigation back into a list. */}
            <nav aria-label="Footer" className="grid gap-10 sm:grid-cols-3 lg:grid-cols-5">
              {columns.map((col, i) => (
                <div key={col.label}>
                  <h2 className={`eyebrow ${COLUMN_INK[i % COLUMN_INK.length]}`}>{col.label}</h2>
                  <ul className="mt-4 space-y-2.5">
                    {col.links.map((l) => (
                      <li key={l.href + l.label}>
                        <Link
                          href={l.href}
                          className="press -mx-2 inline-block rounded px-2 py-0.5 text-body-s text-dim hover:text-text"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-between gap-4 pt-8">
            <p className="meta text-faint">© 2026 Community Health Media</p>
            <div className="flex items-center gap-3">
              <Mark className="size-4 text-faint" />
              <p className="eyebrow text-faint">Medicine moves through shared knowledge</p>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
