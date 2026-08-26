import Link from "next/link";
import { areaBySlug, past, prettyDay, sessions, upcoming } from "@/lib/platform";
import { Button, Eyebrow } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { AbstractFigure } from "@/components/abstract-figure";
import { ArrowRight } from "@/components/icons";

export const metadata = { title: "Live · CHM" };

const MONTH = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short" }).toUpperCase();
const DAY = (iso: string) => new Date(iso + "T12:00:00Z").getUTCDate();

/**
 * Row layout mirrors the platform's own live view: a stacked
 * month/day chip leads, then the title, then the schedule detail,
 * with the status carried in words as well as colour.
 */
function SessionRow({ s }: { s: (typeof sessions)[number] }) {
  const isPast = s.status === "past";
  const area = areaBySlug(s.area);

  return (
    <Link
      href={`/live/${s.slug}`}
      className="card group grid items-center gap-x-6 gap-y-4 p-5 md:grid-cols-[5rem_1fr_auto_2rem]"
    >
      {/* Date chip */}
      <span
        className="grid h-20 w-20 place-items-center rounded-[6px] text-center"
        style={{
          background: isPast ? "var(--color-surface-2)" : "var(--color-anchor)",
          // Anchor is a bright fill in dark and a deep one in light, so
          // the label takes the ground either way.
          color: isPast ? "var(--color-muted)" : "var(--color-ground)",
        }}
      >
        <span>
          <span className="eyebrow block opacity-80">{MONTH(s.date)}</span>
          <span className="display block text-[1.75rem] leading-none tabular-nums">{DAY(s.date)}</span>
        </span>
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className="eyebrow inline-flex items-center rounded-[6px] px-2.5 py-1"
            style={
              isPast
                ? { background: "var(--color-surface-2)", color: "var(--color-muted)" }
                : { background: "var(--color-cta)", color: "var(--color-ground)" }
            }
          >
            {isPast ? "Replay" : "Registration open"}
          </span>
          {area ? <span className="meta text-faint">{area.label}</span> : null}
        </span>
        <span className="display mt-2 block text-display-s text-text">{s.title}</span>
        <span className="mt-1 block text-body-s text-muted">{s.faculty}</span>
      </span>

      <span className="text-body-s text-muted md:text-end">
        <span className="block">{prettyDay(s.date)}</span>
        <span className="meta mt-1 block text-faint">
          {s.time} · {s.duration}
        </span>
      </span>

      <ArrowRight
        className="size-4 shrink-0 text-muted transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1 group-hover:text-text"
        strokeWidth={1.75}
      />
    </Link>
  );
}

export default function LivePage() {
  const next = upcoming();
  const done = past();

  return (
    <>
      <section className="rail pt-14 pb-12 md:pt-16 md:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
          <div>
            <Eyebrow>Live</Eyebrow>
            <h1 className="display mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
              Live and upcoming sessions
            </h1>
            <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted">
              Click any session to register and join. Replays are chaptered and filed under their
              disease state within a week.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href={next.length ? `/live/${next[0].slug}` : "/catalog"} variant="cta" withArrow>
                {next.length ? "Register for the next session" : "Browse the library"}
              </Button>
              <Button href="/chm-office-hours" variant="outline">
                CHM Office Hours
              </Button>
            </div>
          </div>

          <AbstractFigure variant="broadcast" />
        </div>
      </section>

      {next.length > 0 ? (
        <section aria-labelledby="upcoming-heading" className="rail pb-14">
          <h2 id="upcoming-heading" className="eyebrow text-faint">
            Upcoming · {next.length}
          </h2>
          <ul className="mt-5 space-y-3">
            {next.map((s, i) => (
              <Reveal as="li" key={s.slug} delay={i * 50}>
                <SessionRow s={s} />
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="past-heading" className="rail pb-24">
        <h2 id="past-heading" className="eyebrow text-faint">
          Past · last {done.length}
        </h2>
        <ul className="mt-5 space-y-3">
          {done.map((s, i) => (
            <Reveal as="li" key={s.slug} delay={i * 50}>
              <SessionRow s={s} />
            </Reveal>
          ))}
        </ul>
      </section>
    </>
  );
}
