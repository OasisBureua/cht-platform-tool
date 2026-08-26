import { itemsByFormat } from "@/lib/data";
import { PageHeader } from "@/components/page-header";
import { Feed } from "@/components/feed";

export const metadata = { title: "Editorial · CHM" };

export default function EditorialPage() {
 return (
 <>
 <PageHeader
 eyebrow="Written by faculty"
 title="Short reads that hold a position"
 sub="Five to eight minutes on what a readout changes, and what it leaves alone."
 />
 <Feed items={itemsByFormat("editorial")} showFormatFilter={false} />
 </>
 );
}
