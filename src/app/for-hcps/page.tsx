import Link from "next/link";
import { areas, playlists, prettyDay, upcoming } from "@/lib/platform";
import { Band, Button, SectionHead, Thumb } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import { CatalogPanel } from "@/components/hero-panels";
import { Reveal } from "@/components/reveal";
import { ArrowRight } from "@/components/icons";

export const metadata = { title: "For HCPs · CHM" };

const entry = [
 { label: "Clinical Conversations", href: "/catalog", cta: "Conversations" },
 { label: "CHM Office Hours", href: "/chm-office-hours", cta: "View sessions" },
 { label: "Live panels", href: "/live", cta: "Join now" },
];

export default function ForHcpsPage() {
 const next = upcoming();

 return (
 <>
 <PageHead
 eyebrow="For HCPs"
 title="Built for the ten minutes you actually have"
 lede="Free for clinicians. Everything is organised by therapeutic area first, then by how much time you have: a full session, an audio cut for the drive, or a written explainer between patients."
        figure={<CatalogPanel />}
 >
 <div className="flex flex-wrap gap-3">
 <Button href="/join" withArrow>
 Create a free account
 </Button>
 <Button href="/catalog" variant="outline">
 Browse the library
 </Button>
 </div>
 </PageHead>

 <section className="">
 <div className="rail py-14">
 <ul className="grid gap-4 md:grid-cols-3">
 {entry.map((e, i) => (
 <Reveal as="li" key={e.label} delay={i * 60}>
 <Link
 href={e.href}
 className="press lift group flex h-full items-center justify-between gap-6 card p-6"
 >
 <span>
 <span className="eyebrow block text-amber-ink">New</span>
 <span className="display mt-2 block text-body-l text-text">{e.label}</span>
 </span>
 <span className="inline-flex shrink-0 items-center gap-1.5 text-body-s text-muted group-hover:text-text">
 {e.cta}
 <ArrowRight className="size-4" strokeWidth={1.75} />
 </span>
 </Link>
 </Reveal>
 ))}
 </ul>
 </div>
 </section>

 <Band labelledBy="hcp-playlists">
 <SectionHead
 id="hcp-playlists"
 index="01 / Playlists"
 title="Featured biomarker playlists"
 seeAll={{ noun: "playlists", href: "/catalog" }}
 />
 <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {playlists.map((p, i) => (
 <Reveal as="li" key={p.slug} delay={i * 60}>
 <Link
 href={`/catalog/${p.area}?playlist=${p.slug}`}
 className="press lift group flex h-full flex-col gap-5 card p-5"
 >
 <Thumb src={p.cover} className="aspect-video w-full" />
 <div className="flex flex-1 flex-col">
 <h3 className="display text-body-l text-text">{p.label}</h3>
 <p className="prose-lede mt-2 text-body-s text-muted">{p.blurb}</p>
 <p className="meta mt-auto pt-6 text-faint">Play all · {p.count} videos</p>
 </div>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>

 <Band labelledBy="hcp-areas">
 <SectionHead
 id="hcp-areas"
 index="02 / Areas"
 title="View treatment-specific content"
 sub="Expert-led education, conversations and resources by therapeutic area."
 />
 <ul className="mt-12 grid gap-4 md:grid-cols-3">
 {areas.map((a, i) => (
 <Reveal as="li" key={a.slug} delay={i * 70}>
 <Link
 href={`/catalog/${a.slug}`}
 className="press lift group flex h-full flex-col card p-7"
 >
 <h3 className="display text-display-s text-text">{a.label}</h3>
 <p className="prose-lede mt-3 text-body-s text-muted">{a.blurb}</p>
 <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-body-s text-muted group-hover:text-text">
 Explore treatment
 <ArrowRight className="size-4" strokeWidth={1.75} />
 </span>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>

 <Band labelledBy="hcp-live">
 <SectionHead id="hcp-live" index="03 / Live" title="Webinars" seeAll={{ noun: "sessions", href: "/live" }} />
 <ul className="mt-10 space-y-3 mt-2">
 {next.map((s, i) => (
 <Reveal as="li" key={s.slug} delay={i * 50}>
 <Link
 href={`/live/${s.slug}`}
 className="press group grid items-center gap-x-8 gap-y-2 py-6 md:grid-cols-[12rem_1fr_auto]"
 >
 <div>
 <p className="meta text-accent">{prettyDay(s.date)}</p>
 <p className="meta mt-1 text-faint">{s.time} · {s.duration}</p>
 </div>
 <div>
 <h3 className="display text-body-l text-text">{s.title}</h3>
 <p className="mt-1 text-body-s text-muted">{s.faculty}</p>
 </div>
 <span className="inline-flex items-center gap-1.5 justify-self-start text-body-s text-muted group-hover:text-text md:justify-self-end">
 Learn more
 <ArrowRight className="size-4" strokeWidth={1.75} />
 </span>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>
 </>
 );
}
