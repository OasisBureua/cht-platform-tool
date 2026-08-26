import Link from "next/link";
import { diseaseStates, itemsByDisease, seriesByDisease } from "@/lib/data";
import { PageHeader } from "@/components/page-header";

export const metadata = { title: "Disease states · CHM" };

export default function DiseaseIndex() {
 return (
 <>
 <PageHeader
 eyebrow="Browse the library"
 title="Six clinical areas at launch"
 sub="Every track carries video, podcast and editorial from the same faculty conversations."
 />
 <section className="shell pb-16">
 <div className="grid gap-[13px] md:grid-cols-2 xl:grid-cols-3">
 {diseaseStates.map((d) => (
 <Link
 key={d.slug}
 href={`/disease/${d.slug}`}
 className="press lift group rounded-[20px] bg-white shadow-[var(--shadow-card)] p-7 "
 >
 <h2 className="display display-tight text-[1.625rem] text-text group-hover:text-anchor">{d.full}</h2>
 <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">{d.blurb}</p>
 <p className="eyebrow mt-6 text-anchor">
 {seriesByDisease(d.slug).length} series · {itemsByDisease(d.slug).length} sessions →
 </p>
 </Link>
 ))}
 </div>
 </section>
 </>
 );
}
