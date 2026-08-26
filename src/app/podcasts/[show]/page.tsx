import Link from "next/link";
import { notFound } from "next/navigation";
import {
 byNewest,
 facultyBySlug,
 formatHref,
 itemsByFormat,
 itemsByShow,
 prettyDate,
 showBySlug,
 shows,
} from "@/lib/data";
import { Mark } from "@/components/mark";
import { Eyebrow, SectionHead } from "@/components/ui";

export function generateStaticParams() {
 return shows.map((s) => ({ show: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ show: string }> }) {
 const { show } = await params;
 return { title: `${showBySlug(show)?.title ?? "Podcast"} · CHM` };
}

export default async function ShowPage({ params }: { params: Promise<{ show: string }> }) {
 const { show } = await params;
 const s = showBySlug(show);
 if (!s) notFound();

 const host = facultyBySlug(s.host);
 const own = byNewest(itemsByShow(show));
 const episodes = own.length ? own : byNewest(itemsByFormat("podcast")).slice(0, 4);

 return (
 <>
 <section className="bg-cta-deep">
 <div className="shell grid items-center gap-10 py-12 lg:grid-cols-[320px_minmax(0,1fr)]">
 <div className="relative aspect-square overflow-hidden rounded-[20px] bg-black">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={s.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
 <Mark className="absolute bottom-6 start-6 h-10 w-10 text-white" />
 </div>

 <div>
 <Eyebrow tone="amber">CHM podcast network</Eyebrow>
 <h1 className="display display-tight mt-4 text-[2.5rem] text-white md:text-display-xl">{s.title}</h1>
 <p className="mt-2 text-base text-white/70">{s.tagline}</p>
 <p className="mt-5 max-w-[560px] text-body-m leading-relaxed text-white/70">{s.about}</p>

 <div className="mt-8 flex flex-wrap items-center gap-6">
 {host ? (
 <Link href={`/faculty/${host.slug}`} className="press lift group flex items-center gap-3">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={host.photo} alt="" className="h-11 w-11 img-ring rounded-full object-cover" />
 <span>
 <span className="block text-body-s font-semibold text-white group-hover:text-amber">
 {host.name}
 </span>
 <span className="block text-[11px] text-white/75">Host</span>
 </span>
 </Link>
 ) : null}
 <span className="eyebrow text-amber">{s.episodes} episodes</span>
 </div>
 </div>
 </div>
 </section>

 <section className="shell py-12">
 <SectionHead title="Episodes" seeAll={{ noun: "shows", href: "/podcasts" }} />
 <ol className="mt-7 divide-y divide-hairline border-t border-hairline">
 {episodes.map((item, i) => (
 <li key={item.slug}>
 <Link
 href={formatHref(item)}
 className="press lift group grid items-center gap-5 py-6 md:grid-cols-[48px_1fr_auto]"
 >
 <span className="display display-tight text-[1.5rem] text-faint group-hover:text-anchor">
 {String(episodes.length - i).padStart(2, "0")}
 </span>
 <div>
 <h3 className="display display-tight text-display-s text-text group-hover:text-anchor">
 {item.title}
 </h3>
 <p className="mt-2 max-w-[620px] text-[0.875rem] leading-normal text-muted">
 {item.dek}
 </p>
 <p className="meta mt-3 text-faint">
 {item.faculty.map((f) => facultyBySlug(f)?.name).join(" · ")}
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
