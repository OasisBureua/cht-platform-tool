import Link from "next/link";
import { notFound } from "next/navigation";
import { areaBySlug, prettyDay, sessions } from "@/lib/platform";
import { Band, Button, SectionHead, Thumb } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export function generateStaticParams() {
 return sessions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${sessions.find((s) => s.slug === slug)?.title ?? "Session"} · CHM` };
}

export default async function SessionPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const s = sessions.find((x) => x.slug === slug);
 if (!s) notFound();

 const isPast = s.status === "past";
 const others = sessions.filter((x) => x.slug !== s.slug).slice(0, 3);

 return (
 <>
 <section className="rail pt-14 pb-12">
 <nav className="meta flex items-center gap-2 text-faint">
 <Link href="/live" className="press -my-1.5 inline-block rounded py-1.5 hover:text-text">
 Live
 </Link>
 <span>/</span>
 <span>{areaBySlug(s.area)?.label}</span>
 </nav>

 <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1fr_22rem]">
 <div>
 <span
 className={`eyebrow inline-flex rounded-[6px] px-3 py-1.5 ${
 isPast ? "bg-surface-2 text-muted" : "bg-amber/20 text-amber-ink"
 }`}
 >
 {isPast ? "Replay available" : "Registration open"}
 </span>
 <h1 className="display mt-6 max-w-[22ch] text-display-l text-text">{s.title}</h1>
 <p className="mt-4 text-body-l text-muted">{s.faculty}</p>

 <div className="mt-10">
 <Thumb
 src="/img/thumb-cleopatra.jpg"
 duration={isPast ? s.duration : "Live"}
 className="aspect-video w-full"
 rounded="rounded-[6px]"
 />
 </div>
 </div>

 <aside className="card p-7">
 <h2 className="display text-body-l text-text">{isPast ? "Session details" : "Save your seat"}</h2>
 <dl className="mt-6 space-y-5 mt-2 pt-6">
 {[
 ["Date", prettyDay(s.date)],
 ["Time", s.time],
 ["Runs", s.duration],
 ["Area", areaBySlug(s.area)?.label ?? ""],
 ].map(([k, v]) => (
 <div key={k} className="flex items-baseline justify-between gap-4">
 <dt className="eyebrow text-faint">{k}</dt>
 <dd className="text-body-s text-text tabular-nums">{v}</dd>
 </div>
 ))}
 </dl>
 <div className="mt-8">
 <Button href="/join" className="w-full" withArrow>
 {isPast ? "Watch the replay" : "Register free"}
 </Button>
 </div>
 <p className="prose-lede mt-4 text-body-s text-muted">
 Free for clinicians. Carries 0.5 AMA PRA Category 1 Credit on completion.
 </p>
 </aside>
 </div>
 </section>

 <Band labelledBy="more-sessions">
 <SectionHead id="more-sessions" index="01 / Schedule" title="Also on the calendar" seeAll={{ noun: "sessions", href: "/live" }} />
 <ul className="mt-10 space-y-3 mt-2">
 {others.map((o, i) => (
 <Reveal as="li" key={o.slug} delay={i * 50}>
 <Link href={`/live/${o.slug}`} className="press group grid items-center gap-x-8 gap-y-2 py-6 md:grid-cols-[12rem_1fr]">
 <p className="meta text-accent">{prettyDay(o.date)}</p>
 <div>
 <h3 className="display text-body-l text-text">{o.title}</h3>
 <p className="mt-1 text-body-s text-muted">{o.faculty}</p>
 </div>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>
 </>
 );
}
