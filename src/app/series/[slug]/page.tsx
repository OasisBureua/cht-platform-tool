import Link from "next/link";
import { notFound } from "next/navigation";
import {
 byNewest,
 diseaseBySlug,
 facultyBySlug,
 formatHref,
 itemsBySeries,
 itemsByDisease,
 prettyDate,
 series,
 seriesBySlug,
} from "@/lib/data";
import { Eyebrow, FormatBadge, SectionHead, Thumb } from "@/components/ui";

export function generateStaticParams() {
 return series.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${seriesBySlug(slug)?.title ?? "Series"} · CHM` };
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const s = seriesBySlug(slug);
 if (!s) notFound();

 const host = facultyBySlug(s.faculty);
 const disease = diseaseBySlug(s.disease);
 const own = byNewest(itemsBySeries(slug));
 const episodes = own.length
 ? own
 : byNewest(itemsByDisease(s.disease)).slice(0, Math.min(s.episodes, 4));

 return (
 <>
 <section className="bg-cta-deep">
 <div className="shell grid items-center gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
 <div>
 <nav className="meta flex items-center gap-2 text-white/70">
 <Link href={`/disease/${s.disease}`} className="press -my-1.5 inline-block rounded py-1.5 hover:text-amber">
 {disease?.full}
 </Link>
 <span>/</span>
 <span>Series</span>
 </nav>
 <Eyebrow tone="amber" className="mt-6">
 {s.kicker}
 </Eyebrow>
 <h1 className="display display-tight mt-4 text-[2.5rem] text-white md:text-display-xl">{s.title}</h1>
 <p className="mt-5 max-w-[540px] text-base leading-relaxed text-white/75">
 {s.summary}
 </p>

 {host ? (
 <Link href={`/faculty/${host.slug}`} className="press lift group mt-8 flex items-center gap-4">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={host.photo} alt="" className="h-12 w-12 img-ring rounded-full object-cover" />
 <span>
 <span className="block text-[0.875rem] font-semibold text-white group-hover:text-amber">
 {host.name}
 </span>
 <span className="block text-[0.75rem] text-white/75">{host.org}</span>
 </span>
 </Link>
 ) : null}
 </div>

 <Thumb src={s.cover} className="aspect-[4/3] w-full" rounded="rounded-[20px]" />
 </div>
 </section>

 <section className="shell py-12">
 <SectionHead title={`${s.episodes} episodes`} sub="Watch in order, or start where you are stuck." />
 <ol className="mt-7 divide-y divide-hairline border-t border-hairline">
 {episodes.map((item, i) => (
 <li key={item.slug}>
 <Link
 href={formatHref(item)}
 className="press lift group grid items-center gap-5 py-6 md:grid-cols-[48px_200px_1fr_auto]"
 >
 <span className="display display-tight text-[1.5rem] text-faint group-hover:text-anchor">
 {String(i + 1).padStart(2, "0")}
 </span>
 <div className="relative">
 <Thumb src={item.thumb} className="aspect-[16/9] w-full" />
 <div className="absolute top-3 start-3">
 <FormatBadge format={item.format} />
 </div>
 </div>
 <div>
 <h3 className="display display-tight text-display-s text-text group-hover:text-anchor">
 {item.title}
 </h3>
 <p className="mt-2 max-w-[560px] text-[0.875rem] leading-normal text-muted">
 {item.dek}
 </p>
 </div>
 <div className="text-start md:text-end">
 <p className="meta text-anchor">{item.duration}</p>
 <p className="meta mt-1 text-faint">{prettyDate(item.published)}</p>
 </div>
 </Link>
 </li>
 ))}
 </ol>
 </section>
 </>
 );
}
