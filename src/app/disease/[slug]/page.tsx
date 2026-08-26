import Link from "next/link";
import { notFound } from "next/navigation";
import {
 byNewest,
 diseaseBySlug,
 diseaseStates,
 facultyBySlug,
 itemsByDisease,
 seriesByDisease,
} from "@/lib/data";
import { Chip, Eyebrow, NewBadge, SectionHead, Thumb } from "@/components/ui";
import { Feed } from "@/components/feed";

export function generateStaticParams() {
 return diseaseStates.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${diseaseBySlug(slug)?.full ?? "Disease state"} · CHM` };
}

export default async function DiseasePage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const disease = diseaseBySlug(slug);
 if (!disease) notFound();

 const tracks = seriesByDisease(slug);
 const feed = byNewest(itemsByDisease(slug));

 return (
 <>
 <section className="bg-cta-deep">
 <div className="shell pt-12 pb-10">
 <Eyebrow tone="amber">Disease state</Eyebrow>
 <h1 className="display display-tight mt-4 text-display-l text-white md:text-[3.125rem]">{disease.full}</h1>
 <p className="mt-4 max-w-[560px] text-base leading-relaxed text-white/70">
 {disease.blurb}
 </p>

 <div className="mt-8 flex flex-wrap gap-2">
 {diseaseStates.map((d) => (
 <Chip
 key={d.slug}
 href={`/disease/${d.slug}`}
 current={d.slug === slug}
 >
 {d.label}
 </Chip>
 ))}
 </div>

 <dl className="mt-9 flex flex-wrap gap-x-12 gap-y-4">
 {[
 [String(tracks.length), "series"],
 [String(feed.length), "sessions"],
 [String(new Set(feed.flatMap((i) => i.faculty)).size), "faculty"],
 ].map(([n, l]) => (
 <div key={l}>
 <dt className="display display-tight text-[1.75rem] text-amber">{n}</dt>
 <dd className="meta mt-1 text-white/75">{l}</dd>
 </div>
 ))}
 </dl>
 </div>
 </section>

 {tracks.length > 0 ? (
 <section className="shell py-12">
 <SectionHead title="Series in this track" />
 <div className="mt-7 grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
 {tracks.map((s) => {
 const f = facultyBySlug(s.faculty);
 return (
 <Link
 key={s.slug}
 href={`/series/${s.slug}`}
 className="press lift group relative flex min-h-[16.5rem] flex-col overflow-hidden rounded-[18px] sm:min-h-[18.75rem] bg-white shadow-[var(--shadow-card)] "
 >
 <div className="absolute top-4 start-4 z-10">{s.isNew ? <NewBadge /> : null}</div>
 <div className="absolute inset-y-5 end-4 w-[120px] sm:inset-y-auto sm:top-[44px] sm:end-0 sm:h-[150px] sm:w-[132px]">
 <Thumb src={s.cover} className="h-full w-full" rounded="rounded-none" />
 </div>
 <div className="relative z-[5] flex flex-1 flex-col p-5 pt-[52px]">
 <h3 className="display display-tight max-w-[170px] text-display-s text-text group-hover:text-anchor">
 {s.title}
 </h3>
 <p className="mt-3 max-w-[150px] text-body-s text-muted">{s.kicker}</p>
 <div className="mt-auto">
 <p className="meta text-anchor">{f?.name}</p>
 <p className="eyebrow mt-1.5 text-faint">{s.episodes} episodes</p>
 </div>
 </div>
 </Link>
 );
 })}
 </div>
 </section>
 ) : null}

 <section className="shell">
 <SectionHead title="Every session in this track" />
 </section>
 <div className="pt-4">
 <Feed items={feed} showDiseaseFilter={false} />
 </div>
 </>
 );
}
