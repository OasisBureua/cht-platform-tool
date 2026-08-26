import { itemsByFormat } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Feed } from "@/components/feed";

export const metadata = { title: "Videos · CHM" };

export default function VideosPage() {
 return (
 <>
 <PageHeader
 eyebrow="Peer-led video"
 title="Case discussions, not narrated slides"
 sub="Two clinicians, one case, and a disagreement they work through on camera."
 />
 <Feed items={itemsByFormat("video")} showFormatFilter={false} />
 </>
 );
}
