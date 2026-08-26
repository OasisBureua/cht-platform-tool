import { items } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Feed } from "@/components/feed";

export const metadata = { title: "Latest · CHM" };

export default function LatestPage() {
 return (
 <>
 <PageHeader
 eyebrow="Everything, newest first"
 title="Latest on CHM"
 sub="Every session across video, podcast and editorial. Filter by format or by tumor track."
 />
 <Feed items={items} />
 </>
 );
}
