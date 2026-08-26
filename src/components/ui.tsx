import Link from "next/link";
import type { ReactNode } from "react";
import type { Format, Item } from "@/lib/data";
import { facultyBySlug, formatHref, tagTone } from "@/lib/data";
import { Mark } from "./mark";
import { ArrowRight } from "./icons";

/* ── buttons ─────────────────────────────────────────────
 Primary inverts to white on the dark ground; secondary
 is a hairline outline. Both stay pill-shaped. */

type Variant = "solid" | "outline" | "accent" | "cta";

const variants: Record<Variant, string> = {
 solid: "bg-signature text-ground hover:brightness-[0.94]",
 outline: "bg-surface text-text shadow-[var(--shadow-card)] hover:bg-ground hover:shadow-[var(--shadow-card-hover)]",
 accent: "bg-amber text-ground hover:brightness-[0.96]",
 /* Warm CTA: Amber carries the emphasis the brief asks for,
 with Precision Ink on it rather than white. */
 cta: "bg-cta text-ground hover:bg-cta-deep",
};

const buttonBase =
 "press inline-flex h-11 items-center justify-center gap-2 rounded-[6px] ps-6 pe-6 font-mono text-[0.875rem] tracking-[-0.011em] has-[svg:last-child]:pe-5";

export function Button({
 href,
 children,
 variant = "solid",
 className = "",
 withArrow = false,
}: {
 href: string;
 children: ReactNode;
 variant?: Variant;
 className?: string;
 withArrow?: boolean;
}) {
 return (
 <Link href={href} className={`${buttonBase} ${variants[variant]} ${className}`}>
 {children}
 {withArrow ? <ArrowRight className="size-4" strokeWidth={1.75} /> : null}
 </Link>
 );
}

/* ── text ────────────────────────────────────────────────── */

export function Eyebrow({
 children,
 tone = "faint",
 className = "",
 as: As = "p",
}: {
 children: ReactNode;
 tone?: "faint" | "cyan" | "amber";
 className?: string;
 as?: "p" | "span" | "h2";
}) {
 const tones = { faint: "text-muted", cyan: "text-anchor", amber: "text-amber" };
 return <As className={`eyebrow ${tones[tone]} ${className}`}>{children}</As>;
}

/**
 * Section chrome: a full-bleed hairline, a mono index label on
 * the leading edge, the heading, and one "see all" affordance.
 */
export function SectionHead({
  index,
  title,
  sub,
  seeAll,
  id,
}: {
  index?: string;
  title: string;
  sub?: string;
  seeAll?: { noun: string; href: string };
  id?: string;
}) {
  return (
    <div>
      {/* Index, title and the action share one centred baseline; the
          index keeps a fixed width so every section title on the page
          starts at the same x. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-6">
          {index ? (
            <Eyebrow className="hidden w-28 shrink-0 md:block">{index}</Eyebrow>
          ) : null}
          <h2 id={id} className="display text-display-m text-text">
            {title}
          </h2>
        </div>
        {seeAll ? (
          <Link
            href={seeAll.href}
            className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-[var(--shadow-card)] hover:bg-ground hover:text-text hover:shadow-[var(--shadow-card-hover)]"
          >
            See all {seeAll.noun}
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      {sub ? (
        <p className="prose-lede mt-4 max-w-[52ch] text-body-m text-muted md:ms-[8.5rem]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

/** Full-bleed band with a hairline lid. */
export function Band({
 children,
 className = "",
 labelledBy,
 ruled = true,
}: {
 children: ReactNode;
 className?: string;
 labelledBy?: string;
 ruled?: boolean;
}) {
 return (
 <section aria-labelledby={labelledBy} className={ruled ? "" : undefined}>
 <div className={`rail py-16 md:py-24 ${className}`}>{children}</div>
 </section>
 );
}

/* ── badges ──────────────────────────────────────────────── */

export function FormatBadge({ format }: { format: Format }) {
 return (
 <span className="eyebrow inline-flex h-6 items-center rounded-[6px] bg-ground/70 px-3 text-text backdrop-blur-sm">
 {format}
 </span>
 );
}

export function NewBadge() {
 return (
 <span className="eyebrow inline-flex h-6 items-center rounded-[6px] bg-amber px-3 text-ground">
 New
 </span>
 );
}

/* ── media ───────────────────────────────────────────────── */

export function Thumb({
 src,
 duration,
 className = "",
 rounded = "rounded-[6px]",
}: {
 src: string;
 duration?: string;
 className?: string;
 rounded?: string;
}) {
 return (
 <div className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={src}
 alt=""
 className="absolute inset-0 size-full object-cover opacity-90 transition-[scale,opacity] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03] group-hover:opacity-100"
 />
 <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
 <div className="img-ring absolute inset-0 rounded-[inherit]" />
 <Mark className="absolute bottom-3 start-3 size-5 text-white/80" />
 {duration ? (
 <span className="meta absolute end-3 bottom-3 text-white/80">{duration}</span>
 ) : null}
 </div>
 );
}

/* ── cards ───────────────────────────────────────────────── */

/**
 * Cards are hairline cells, not tinted surfaces: the grid reads
 * as one ruled table rather than a tray of coloured chips.
 */
export function ContentCard({ item }: { item: Item }) {
 const lead = facultyBySlug(item.faculty[0]);
 return (
 <Link
 href={formatHref(item)}
 className="press lift group flex h-full flex-col gap-5 rounded-[6px] p-5 shadow-[var(--shadow-card)]"
 >
 <div className="relative">
 <Thumb src={item.thumb} className="aspect-video w-full" />
 <div className="absolute top-3 start-3">
 <FormatBadge format={item.format} />
 </div>
 </div>
 <div className="flex flex-1 flex-col">
 <h3 className="display text-display-s text-text">{item.title}</h3>
 <p className="prose-lede mt-2 line-clamp-2 max-w-[52ch] text-body-s text-muted">{item.dek}</p>
 <div className="mt-auto flex items-end justify-between gap-3 pt-6">
 <span className="meta text-faint">{lead?.name}</span>
 <span className="meta text-dim">{item.duration}</span>
 </div>
 </div>
 </Link>
 );
}

export function CompactCard({ item }: { item: Item }) {
 return (
 <Link
 href={formatHref(item)}
 className="press lift group flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-[var(--shadow-card)]"
 >
 <div className="relative">
 <Thumb src={item.thumb} className="aspect-video w-full" />
 <div className="absolute top-3 start-3">
 <FormatBadge format={item.format} />
 </div>
 </div>
      <div className="flex flex-1 flex-col px-1 pb-1">
        <h3 className="display line-clamp-2 text-body-m text-text">{item.title}</h3>
        {/* Tags are spans, not links: the card is already one link, and
            nesting a second inside it is invalid. They read as the
            session's own labels and follow whatever the feed carries. */}
        {item.tags.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.slice(0, 2).map((t) => {
              const tone = tagTone(t);
              return (
                <li
                  key={t}
                  className="inline-flex h-6 items-center rounded-[6px] px-2 text-[0.6875rem] leading-none"
                  style={{ background: tone.fill, color: tone.label }}
                >
                  {t}
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="meta mt-auto pt-4 tabular-nums text-faint">{item.duration}</p>
      </div>
    </Link>
  );
}

/* ── list row ────────────────────────────────────────────── */

export function EmptyState({
 title,
 body,
 action,
}: {
 title: string;
 body: string;
 action: { label: string; href: string };
}) {
 return (
 <div className="rounded-[6px] px-8 py-16 text-center shadow-[var(--shadow-card)]">
 <p className="display text-display-s text-text">{title}</p>
 <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted">{body}</p>
 <div className="mt-7 flex justify-center">
 <Button href={action.href} variant="outline">
 {action.label}
 </Button>
 </div>
 </div>
 );
}

/* ── chips ───────────────────────────────────────────────── */

export function Chip({
 href,
 children,
 current = false,
}: {
 href: string;
 children: ReactNode;
 current?: boolean;
}) {
 return (
 <Link
 href={href}
 aria-current={current ? "page" : undefined}
 className={`press inline-flex h-9 items-center rounded-[6px] px-4 text-body-s ${
 current
 ? "bg-text text-ground"
 : "text-dim shadow-[var(--shadow-card)] hover:text-text hover:ring-white/25"
 }`}
 >
 {children}
 </Link>
 );
}
