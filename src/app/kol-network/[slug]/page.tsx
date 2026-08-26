import Link from "next/link";
import { notFound } from "next/navigation";
import { kols } from "@/lib/platform";
import { byNewest, items } from "@/lib/data";
import { Band, Button, CompactCard, SectionHead } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import { Reveal } from "@/components/reveal";

export function generateStaticParams() {
 return kols.map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${kols.find((k) => k.slug === slug)?.name ?? "Profile"} · CHM` };
}

export default async function KolPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const k = kols.find((x) => x.slug === slug);
 if (!k) notFound();

 const recorded = byNewest(items).slice(0, 4);

 return (
 <>
 <section className="rail pt-14 pb-12">
 <nav className="meta flex items-center gap-2 text-faint">
 <Link href="/kol-network" className="press -my-1.5 inline-block rounded py-1.5 hover:text-text">
 KOL network
 </Link>
 <span>/</span>
 <span>{k.state}</span>
 </nav>

 <div className="mt-10 flex flex-wrap items-start gap-8">
 {k.photo ? (
 /* eslint-disable-next-line @next/next/no-img-element */
 <img src={k.photo} alt="" className="img-ring size-28 rounded-full object-cover" />
 ) : (
 <span
 aria-hidden
 className="grid size-28 shrink-0 place-items-center rounded-full bg-surface-2 text-display-s text-muted"
 >
 {k.name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
 </span>
 )}
 <div className="min-w-0 flex-1">
 <h1 className="display text-display-l text-text">{k.name}</h1>
 <p className="mt-3 text-body-l text-muted">{k.title}</p>
 <p className="prose-lede mt-6 max-w-[54ch] text-body-m text-muted">{k.summary}</p>
 </div>
 </div>

 <dl className="mt-12 grid gap-8 mt-2 pt-8 sm:grid-cols-3">
 {[
 ["Institution", k.institution],
 ["State", k.state],
 ["Sessions recorded", String(recorded.length)],
 ].map(([label, v]) => (
 <div key={label}>
 <dt className="eyebrow text-faint">{label}</dt>
 <dd className="mt-2 text-body-m text-text">{v}</dd>
 </div>
 ))}
 </dl>
 </section>

 <Band labelledBy="kol-sessions">
 <SectionHead
 id="kol-sessions"
 index="01 / Content"
 title="Recorded with CHM"
 seeAll={{ noun: "sessions", href: "/catalog" }}
 />
 <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {recorded.map((item, i) => (
 <Reveal as="li" key={item.slug} delay={i * 50}>
 <CompactCard item={item} />
 </Reveal>
 ))}
 </ul>
 </Band>

 <section className="">
 <div className="rail flex flex-wrap items-center justify-between gap-8 py-16">
 <h2 className="display max-w-[26ch] text-display-m text-text">
 Want {k.name.replace("Dr. ", "Dr. ")} on your next panel?
 </h2>
 <Button href="/contact" withArrow>
 Talk to the editorial team
 </Button>
 </div>
 </section>
 </>
 );
}
