import Link from "next/link";
import { faculty, itemsByFaculty, seriesByFaculty } from "@/lib/data";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Faculty · CHM" };

export default function FacultyIndex() {
 return (
 <>
 <PageHeader
 eyebrow="In conversation"
 title="Practicing specialists who bring their own audiences"
 sub="CHM faculty are clinicians first. They record between clinics, and it shows."
 />
 <section className="shell pb-16">
 <div className="grid gap-[13px] md:grid-cols-2 xl:grid-cols-3">
 {faculty.map((f) => (
 <Link
 key={f.slug}
 href={`/faculty/${f.slug}`}
 className="press lift group flex gap-5 rounded-[20px] bg-white shadow-[var(--shadow-card)] p-6 "
 >
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img
 src={f.photo}
 alt=""
 className="h-20 w-20 shrink-0 img-ring rounded-full object-cover"
 />
 <div>
 <h2 className="display display-tight text-display-s text-text group-hover:text-anchor">{f.name}</h2>
 <p className="text-body-s text-muted">{f.org}</p>
 <p className="mt-3 text-body-s leading-normal text-muted">{f.bio}</p>
 <p className="eyebrow mt-4 text-anchor">
 {seriesByFaculty(f.slug).length} series · {itemsByFaculty(f.slug).length} sessions
 </p>
 </div>
 </Link>
 ))}
 </div>
 </section>
 </>
 );
}
