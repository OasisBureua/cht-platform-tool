import Link from "next/link";
import { notFound } from "next/navigation";
import { areaBySlug, areas, playlistsByArea, sessions } from "@/lib/platform";
import { byNewest, items } from "@/lib/data";
import { Band, Button, CompactCard, SectionHead, Thumb } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import { Reveal } from "@/components/reveal";

export function generateStaticParams() {
 return areas.map((a) => ({ area: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }) {
 const { area } = await params;
 return { title: `${areaBySlug(area)?.label ?? "Area"} · CHM` };
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
 const { area } = await params;
 const a = areaBySlug(area);
 if (!a) notFound();

 const lists = playlistsByArea(area);
 const upcoming = sessions.filter((s) => s.area === area && s.status === "upcoming");
 const clips = byNewest(items).slice(0, 4);

 return (
 <>
 <PageHead eyebrow={`Content library / ${a.label}`} title={a.label} lede={a.blurb}>
 <div className="flex flex-wrap gap-3">
 {areas.map((x) => (
 <Link
 key={x.slug}
 href={`/catalog/${x.slug}`}
 aria-current={x.slug === area ? "page" : undefined}
 className={`press inline-flex h-10 items-center rounded-[6px] px-5 text-body-s ${
 x.slug === area
 ? "bg-anchor text-ground"
 : "text-dim shadow-[var(--shadow-card)] hover:text-text"
 }`}
 >
 {x.label}
 </Link>
 ))}
 </div>
 <dl className="mt-10 flex flex-wrap gap-x-14 gap-y-6 mt-2 pt-8">
 {[
 [String(a.playlists), "playlists"],
 [String(a.clips), "clips"],
 [String(upcoming.length), "sessions scheduled"],
 ].map(([n, l]) => (
 <div key={l}>
 <dt className="sr-only">{l}</dt>
 <dd>
 <span className="display block text-display-m tabular-nums text-text">{n}</span>
 <span className="mt-1 block text-body-s text-muted">{l}</span>
 </dd>
 </div>
 ))}
 </dl>
 </PageHead>

 {lists.length > 0 ? (
 <Band labelledBy="area-playlists">
 <SectionHead id="area-playlists" index="01 / Playlists" title="Playlists in this area" />
 <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {lists.map((p, i) => (
 <Reveal as="li" key={p.slug} delay={i * 60}>
 <Link
 href={`/catalog/${p.area}?playlist=${p.slug}`}
 className="press lift group flex h-full flex-col gap-5 card p-5"
 >
 <Thumb src={p.cover} className="aspect-video w-full" />
 <div className="flex flex-1 flex-col">
 <h3 className="display text-body-l text-text">{p.label}</h3>
 <p className="prose-lede mt-2 text-body-s text-muted">{p.blurb}</p>
 <p className="meta mt-auto pt-6 text-faint">{p.count} videos</p>
 </div>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>
 ) : null}

 <Band labelledBy="area-clips">
 <SectionHead
 id="area-clips"
 index="02 / Clips"
 title="Latest in this area"
 seeAll={{ noun: "clips", href: "/catalog" }}
 />
 <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
 {clips.map((item, i) => (
 <Reveal as="li" key={item.slug} delay={i * 50}>
 <CompactCard item={item} />
 </Reveal>
 ))}
 </ul>
 </Band>

 <section className="">
 <div className="rail flex flex-wrap items-center justify-between gap-8 py-16">
 <h2 className="display max-w-[24ch] text-display-m text-text">
 {upcoming.length > 0
 ? "Sessions scheduled in this area"
 : "Nothing scheduled here yet"}
 </h2>
 <Button href="/live" variant={upcoming.length > 0 ? "solid" : "outline"} withArrow>
 {upcoming.length > 0 ? "See the schedule" : "See all live sessions"}
 </Button>
 </div>
 </section>
 </>
 );
}
