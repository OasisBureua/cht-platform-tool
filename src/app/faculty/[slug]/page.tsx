import Link from "next/link";
import { notFound } from "next/navigation";
import {
 byNewest,
 faculty,
 facultyBySlug,
 itemsByFaculty,
 seriesByFaculty,
} from "@/lib/data";
import { Eyebrow, SectionHead } from "@/components/ui";
import { Feed } from "@/components/feed";

export function generateStaticParams() {
 return faculty.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${facultyBySlug(slug)?.name ?? "Faculty"} · CHM` };
}

export default async function FacultyPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const person = facultyBySlug(slug);
 if (!person) notFound();

 const sessions = byNewest(itemsByFaculty(slug));
 const tracks = seriesByFaculty(slug);

 return (
 <>
 <section className="bg-cta-deep">
 <div className="shell flex flex-wrap items-center gap-10 py-12">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={person.photo}
 alt=""
 className="h-[168px] w-[168px] img-ring rounded-full object-cover ring-4 ring-white/15"
 />
 <div>
 <Eyebrow tone="amber">{person.role}</Eyebrow>
 <h1 className="display display-tight mt-3 text-[2.5rem] text-white md:text-[2.875rem]">{person.name}</h1>
 <p className="mt-2 text-base text-white/70">{person.org}</p>
 <p className="mt-5 max-w-[560px] text-body-m leading-relaxed text-white/70">
 {person.bio}
 </p>
 <div className="mt-6 flex flex-wrap gap-2">
 {person.focus.map((f) => (
 <span
 key={f}
 className="rounded-[6px] border border-white/25 px-4 py-1.5 text-[0.75rem] text-white/80"
 >
 {f}
 </span>
 ))}
 </div>
 </div>
 </div>
 </section>

 {tracks.length > 0 ? (
 <section className="shell py-12">
 <SectionHead title="Series led by this faculty" />
 <div className="mt-7 grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
 {tracks.map((s) => (
 <Link
 key={s.slug}
 href={`/series/${s.slug}`}
 className="press lift group rounded-[16px] bg-white shadow-[var(--shadow-card)] p-6 "
 >
 <p className="eyebrow text-anchor">{s.kicker}</p>
 <h3 className="display display-tight mt-3 text-display-s text-text group-hover:text-anchor">
 {s.title}
 </h3>
 <p className="mt-3 text-body-s leading-normal text-muted">{s.summary}</p>
 <p className="eyebrow mt-5 text-faint">{s.episodes} episodes →</p>
 </Link>
 ))}
 </div>
 </section>
 ) : null}

 <section className="shell">
 <SectionHead title="Sessions" />
 </section>
 <div className="pt-4">
 {sessions.length > 0 ? (
 <Feed items={sessions} showDiseaseFilter={false} />
 ) : (
 <div className="shell pb-16">
 <p className="text-body-m text-muted">No published sessions yet.</p>
 </div>
 )}
 </div>
 </>
 );
}
