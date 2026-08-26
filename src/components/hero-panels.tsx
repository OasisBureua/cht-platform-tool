import { kols, prettyDay, upcoming, past, diseaseAreas } from "@/lib/platform";
import { byNewest, items } from "@/lib/data";
import { Mark } from "./mark";
import { PlayIcon } from "./icons";

/**
 * Shared frame for the inner-page hero visuals: a raised panel on a
 * soft brand-tinted field, with a bevel highlight along the top edge.
 * Depth only, no outlines.
 */
export function HeroPanel({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="relative">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[24px] opacity-80 blur-2xl"
        style={{
          background:
            "radial-gradient(50% 50% at 70% 30%, color-mix(in oklab, var(--color-beam) 34%, transparent), transparent 70%), radial-gradient(45% 45% at 25% 75%, color-mix(in oklab, var(--color-pink) 30%, transparent), transparent 70%)",
        }}
      />
      <div className="relative overflow-hidden rounded-[6px] bg-surface p-3 shadow-[var(--shadow-pop)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="overflow-hidden rounded-[6px] bg-ground">{children}</div>
      </div>
    </div>
  );
}

function Chrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface px-4 py-3">
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="size-2.5 rounded-full bg-white/15" />
      <span className="meta ms-2 text-faint">{label}</span>
    </div>
  );
}

/* ── Live: the schedule as the product ───────────────────── */
export function LivePanel() {
  const rows = [...upcoming().slice(0, 2), ...past().slice(0, 2)];
  return (
    <HeroPanel>
      <Chrome label="chm / live" />
      <ul className="space-y-2 p-4">
        {rows.map((s, i) => {
          const isPast = s.status === "past";
          const d = new Date(s.date + "T12:00:00Z");
          return (
            <li key={s.slug} className="flex items-center gap-4 rounded-[6px] bg-surface p-3">
              <span
                className="grid size-14 shrink-0 place-items-center rounded-[6px] text-center"
                style={{
                  background: isPast ? "var(--color-surface-2)" : "var(--color-anchor)",
                  color: isPast ? "var(--color-muted)" : "#fff",
                }}
              >
                <span>
                  <span className="eyebrow block opacity-80">
                    {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                  </span>
                  <span className="display block text-[1.125rem] leading-none tabular-nums">
                    {d.getUTCDate()}
                  </span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-s font-medium text-text">{s.title}</span>
                <span className="meta mt-1 block text-faint">
                  {s.time} · {s.duration}
                </span>
              </span>
              <span
                className="eyebrow shrink-0 rounded-[6px] px-2.5 py-1"
                style={
                  isPast
                    ? { background: "var(--color-surface-2)", color: "var(--color-muted)" }
                    : { background: "var(--color-cta)", color: "var(--color-text)" }
                }
              >
                {isPast ? "Replay" : "Open"}
              </span>
              {i === 0 ? null : null}
            </li>
          );
        })}
      </ul>
    </HeroPanel>
  );
}

/* ── KOL network: the directory as the product ───────────── */
export function KolPanel() {
  const rows = kols.slice(0, 4);
  return (
    <HeroPanel>
      <Chrome label="chm / kol-network" />
      <div className="p-4">
        <div className="flex gap-2">
          <span className="flex h-9 flex-1 items-center rounded-[6px] bg-surface px-3 text-body-s text-faint">
            Search name or institution
          </span>
          <span className="flex h-9 items-center rounded-[6px] bg-anchor px-3 text-body-s text-ground">
            39
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map((k) => (
            <li key={k.slug} className="flex items-center gap-3 rounded-[6px] bg-surface p-3">
              {k.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={k.photo} alt="" className="size-9 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.625rem] text-muted">
                  {k.name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-s font-medium text-text">{k.name}</span>
                <span className="meta mt-0.5 block truncate text-faint">{k.institution}</span>
              </span>
              <span className="meta shrink-0 rounded-[6px] bg-surface-2 px-2 py-1 text-muted">
                {k.state.slice(0, 2).toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}

/* ── Office Hours: a case going live ─────────────────────── */
export function OfficeHoursPanel() {
  const lines = [
    { who: "q", t: "62F, HER2+ mBC, progressed on THP at 11 months. Next line?" },
    { who: "a", t: "T-DXd, and I would not wait. The burden is the deciding factor." },
    { who: "a2", t: "I would check ILD risk first. That changes my monitoring cadence." },
  ];
  return (
    <HeroPanel>
      <Chrome label="chm / office-hours · live" />
      <div className="p-4">
        <div className="relative aspect-video overflow-hidden rounded-[6px] bg-anchor">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/thumb-ild.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-90" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <span className="absolute top-3 start-3 inline-flex items-center gap-2 rounded-[6px] bg-cta px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-text" />
            <span className="eyebrow text-text">Live now</span>
          </span>
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-12 place-items-center rounded-[6px] bg-ground/90 text-anchor">
              <PlayIcon className="size-5" />
            </span>
          </span>
          <Mark className="absolute bottom-3 start-3 size-5 text-white/90" />
        </div>

        <ul className="mt-3 space-y-2">
          {lines.map((l, i) => (
            <li
              key={i}
              className={`max-w-[88%] rounded-[6px] px-3 py-2 text-[0.8125rem] leading-relaxed ${
                l.who === "q"
                  ? "ms-auto bg-anchor text-ground"
                  : "bg-surface text-muted"
              }`}
            >
              {l.t}
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}

/* ── Content library: the grid as the product ────────────── */
export function CatalogPanel() {
  const tiles = byNewest(items).slice(0, 4);
  return (
    <HeroPanel>
      <Chrome label="chm / catalog" />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {diseaseAreas.slice(0, 4).map((a, i) => (
            <span
              key={a.slug}
              className="rounded-[6px] px-2.5 py-1 text-[0.6875rem]"
              style={
                i === 0
                  ? { background: a.tone, color: "#fff" }
                  : { background: "var(--color-surface)", color: "var(--color-muted)" }
              }
            >
              {a.label}
            </span>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <li key={t.slug} className="overflow-hidden rounded-[6px] bg-surface">
              <span className="relative block aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.thumb} alt="" className="absolute inset-0 size-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                <span className="meta absolute bottom-2 end-2 text-white/90">{t.duration}</span>
              </span>
              <span className="block truncate px-2.5 py-2 text-[0.6875rem] text-text">{t.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}
