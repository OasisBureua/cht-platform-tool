import Link from "next/link";
import { byNewest, facultyBySlug, itemsByFormat, shows } from "@/lib/data";
import { Mark } from "@/components/mark";
import { PageHeader } from "@/components/page-header";
import { SectionHead } from "@/components/ui";
import { Feed } from "@/components/feed";

export const metadata = { title: "Podcasts · CHM" };

const tints = { sky: "bg-sky", cream: "bg-ground", mist: "bg-surface", page: "bg-white" };

export default function PodcastsPage() {
 return (
 <>
 <PageHeader
 eyebrow="CHM podcast network"
 title="Four shows, one editorial standard"
 sub="Recorded from the same peer conversations that produce the video track."
 />

 <section className="shell pb-14">
 <div className="grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
 {shows.map((s) => {
 const host = facultyBySlug(s.host);
 return (
 <Link
 key={s.slug}
 href={`/podcasts/${s.slug}`}
 className={`press lift group rounded-[16px] p-4 ${tints[s.tint]}`}
 >
 <div className="relative aspect-[280/104] overflow-hidden rounded-[6px] bg-black">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={s.cover}
 alt=""
 className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
 />
 <Mark className="absolute bottom-3 start-3 h-7 w-7 text-white" />
 </div>
 <h2 className="display display-tight mt-4 text-[1.1875rem] text-text group-hover:text-anchor">
 {s.title}
 </h2>
 <p className="mt-1 text-body-s text-muted">{s.tagline}</p>
 <p className="mt-3 text-body-s leading-normal text-muted">{s.about}</p>
 <p className="eyebrow mt-4 text-anchor">
 {s.episodes} episodes · {host?.name}
 </p>
 </Link>
 );
 })}
 </div>
 </section>

 <section className="shell">
 <SectionHead title="Recent episodes" />
 </section>
 <div className="pt-4">
 <Feed items={byNewest(itemsByFormat("podcast"))} showFormatFilter={false} />
 </div>
 </>
 );
}
