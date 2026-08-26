import { kols, kolStates } from "@/lib/platform";
import { PageHead } from "@/components/page-head";
import { KolDirectory } from "@/components/kol-directory";
import { KolPanel } from "@/components/hero-panels";
import { Button } from "@/components/ui";

export const metadata = { title: "KOL network · CHM" };

export default function KolNetworkPage() {
 return (
 <>
 <PageHead
 eyebrow="KOL network"
 title="The faculty behind every session"
 lede={`Oncology and breast cancer specialists across ${kolStates().length} states. Filter by state, institution or specialty, and go from a profile straight to what they have recorded.`}
        figure={<KolPanel />}
 >
 <dl className="flex flex-wrap gap-x-14 gap-y-6">
 {[
 [String(kols.length), "profiles"],
 [String(kolStates().length), "states"],
 [String(kols.filter((k) => k.isNew).length), "added this quarter"],
 ].map(([n, l]) => (
 <div key={l}>
 <dt className="sr-only">{l}</dt>
 <dd>
 <span className="display block text-display-m tabular-nums text-text">{n}</span>
 <span className="mt-1 block text-body-s text-muted">{l}</span>
 </dd>
 </div>
 ))}
 </dl>
 </PageHead>

 <KolDirectory />

 <section className="">
 <div className="rail flex flex-wrap items-center justify-between gap-8 py-16">
 <div>
 <h2 className="display text-display-m text-text">Practising, and want to record?</h2>
 <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted">
 CHM faculty are clinicians first. Sessions are recorded between clinics, in ninety
 minutes, with no script approval.
 </p>
 </div>
 <Button href="/contact" withArrow>
 Talk to the editorial team
 </Button>
 </div>
 </section>
 </>
 );
}
