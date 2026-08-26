import Link from "next/link";
import { notFound } from "next/navigation";
import {
 diseaseBySlug,
 facultyBySlug,
 itemBySlug,
 items,
 itemsByDisease,
 prettyDate,
} from "@/lib/data";
import { CompactCard, Eyebrow, SectionHead, Thumb } from "@/components/ui";

export function generateStaticParams() {
 return items.filter((i) => i.format === "editorial").map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 return { title: `${itemBySlug(slug)?.title ?? "Editorial"} · CHM` };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const item = itemBySlug(slug);
 if (!item || item.format !== "editorial") notFound();

 const disease = diseaseBySlug(item.disease);
 const author = facultyBySlug(item.faculty[0]);
 const related = itemsByDisease(item.disease)
 .filter((i) => i.slug !== item.slug)
 .slice(0, 4);

 return (
 <>
 <article className="shell pt-8 pb-14">
 <nav className="meta flex flex-wrap items-center gap-2 text-faint">
 <Link href="/editorial" className="press -my-1.5 inline-block rounded py-1.5 hover:text-anchor">
 Editorial
 </Link>
 <span>/</span>
 <Link href={`/disease/${item.disease}`} className="press -my-1.5 inline-block rounded py-1.5 hover:text-anchor">
 {disease?.label}
 </Link>
 </nav>

 <div className="mx-auto mt-8 max-w-[720px]">
 <Eyebrow>
 Editorial · {item.duration} read
 </Eyebrow>
 <h1 className="display display-tight mt-4 text-[2.25rem] text-text md:text-[2.75rem]">
 {item.title}
 </h1>
 <p className="mt-5 text-[1.1875rem] leading-normal text-muted">{item.dek}</p>

 {author ? (
 <div className="mt-8 flex items-center gap-4 border-y border-hairline py-5">
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={author.photo} alt="" className="h-12 w-12 img-ring rounded-full object-cover" />
 <div>
 <Link
 href={`/faculty/${author.slug}`}
 className="text-[0.875rem] font-semibold text-text hover:text-anchor"
 >
 {author.name}
 </Link>
 <p className="text-[0.75rem] text-muted">{author.org}</p>
 </div>
 <span className="meta ml-auto text-faint">{prettyDate(item.published)}</span>
 </div>
 ) : null}
 </div>

 <div className="mx-auto mt-10 max-w-[900px]">
 <Thumb src={item.thumb} className="aspect-[16/7] w-full" rounded="rounded-[20px]" />
 </div>

 <div className="mx-auto mt-12 max-w-[680px]">
 {item.body?.map((p, i) => (
 <p
 key={i}
 className={`text-body-l leading-relaxed text-text ${i === 0 ? "" : "mt-6"}`}
 >
 {p}
 </p>
 ))}

 <div className="mt-10 flex flex-wrap gap-2">
 {item.tags.map((t) => (
 <span
 key={t}
 className="rounded-[6px] bg-white shadow-[var(--shadow-card)] px-4 py-1.5 text-[0.75rem] text-muted"
 >
 {t}
 </span>
 ))}
 </div>
 </div>
 </article>

 {related.length > 0 ? (
 <section className="shell pb-16">
 <SectionHead
 title="More in this track"
 seeAll={{ noun: `${disease?.label} sessions`, href: `/disease/${item.disease}` }}
 />
 <div className="mt-7 grid gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
 {related.map((r) => (
 <CompactCard key={r.slug} item={r} />
 ))}
 </div>
 </section>
 ) : null}
 </>
 );
}
