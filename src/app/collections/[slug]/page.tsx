import { notFound } from "next/navigation";
import { byNewest, collections, items } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Feed } from "@/components/feed";
import { Chip } from "@/components/ui";

export function generateStaticParams() {
 return collections.map((c) => ({ slug: c.slug }));
}

const blurbs: Record<string, string> = {
 "most-watched": "What the CHM audience finished, ranked by completed views.",
 "recently-added": "Everything published in the last four weeks.",
 "editors-picks": "Chosen by the CHM editorial team for the argument, not the traffic.",
 "conference-coverage": "Recorded at and around the meetings, with the data still warm.",
 "clinical-controversies": "Sessions where the faculty disagree and do not resolve it.",
};

const orderings: Record<string, (list: typeof items) => typeof items> = {
 "most-watched": (list) =>
 [...list].sort((a, b) => parseFloat(b.views) - parseFloat(a.views)),
 "recently-added": (list) => byNewest(list),
 "editors-picks": (list) => list.filter((i) => i.tags.length > 2),
 "conference-coverage": (list) => list.filter((i) => i.format !== "editorial"),
 "clinical-controversies": (list) => list.filter((i) => i.faculty.length > 1),
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const c = collections.find((x) => x.slug === slug);
 return { title: `${c?.label ?? "Collection"} · CHM` };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
 const { slug } = await params;
 const collection = collections.find((c) => c.slug === slug);
 if (!collection) notFound();

 const list = (orderings[slug] ?? byNewest)(items);

 return (
 <>
 <PageHeader eyebrow="Collection" title={collection.label} sub={blurbs[slug]}>
 <div className="flex flex-wrap gap-2">
 {collections.map((c) => (
 <Chip key={c.slug} href={`/collections/${c.slug}`} current={c.slug === slug}>
 {c.label}
 </Chip>
 ))}
 </div>
 </PageHeader>
 <Feed items={list} />
 </>
 );
}
