import { Mark } from "@/components/mark";
import { Button, Eyebrow, SectionHead } from "@/components/ui";
import { WalkthroughForm } from "@/components/lead-form";

export const metadata = { title: "Partner with CHM" };

const steps = [
 {
 n: "01",
 title: "One conversation",
 body: "Two faculty who already disagree sit down for ninety minutes on a question your brand has a stake in. No slides, no script approval, no talking points.",
 },
 {
 n: "02",
 title: "Four channels",
 body: "That session becomes long-form video, a podcast episode, an editorial explainer and a set of short clips. One recording day, four distribution surfaces.",
 },
 {
 n: "03",
 title: "Placed in the track",
 body: "Everything lands inside the disease state where your audience already browses, next to the sessions they came for.",
 },
 {
 n: "04",
 title: "Measured on completion",
 body: "Not impressions. Completion rate, post-test pass rate and repeat visits by faculty, reported monthly.",
 },
];

const formats = [
 ["Long-form video", "18 to 30 min", "The full case discussion, chaptered."],
 ["Podcast episode", "25 to 40 min", "Audio cut, syndicated across the four CHM shows."],
 ["Editorial explainer", "5 to 8 min read", "Written by faculty, not by a medical writer."],
 ["Short clips", "45 to 90 sec", "Cut for social and for in-feed placement."],
];

export default function PartnerPage() {
 return (
 <>
 <section aria-labelledby="partner-heading" className="on-deep relative overflow-hidden bg-cta-deep">
 <div
 aria-hidden
 className="pointer-events-none absolute -top-[260px] right-[-140px] h-[700px] w-[700px] rounded-[6px] bg-signature/[0.16] blur-[75px]"
 />
 <div className="shell relative flex flex-wrap items-center justify-between gap-10 py-16">
 <div>
 <Eyebrow tone="amber">For pharma partners</Eyebrow>
 <h1 id="partner-heading" className="display display-tight mt-4 max-w-[48rem] text-[2.5rem] text-white md:text-[3.125rem]">
 Whole-brand education starts with the audience.
 </h1>
 <p className="mt-6 max-w-[540px] text-[1.0625rem] leading-relaxed text-white/75">
 CHM does not sell impressions against a banner. We sell the completed session, the
 faculty relationship behind it, and the four channels one recording produces.
 </p>
 <div className="mt-9 flex flex-wrap gap-4">
 <Button href="#walkthrough" variant="accent">
 Book a walkthrough
 </Button>
 <Button href="/latest" variant="outline">
 Browse the library
 </Button>
 </div>
 </div>
 <Mark className="hidden h-[118px] w-[120px] text-amber lg:block" />
 </div>
 </section>

 <section id="how" className="shell py-14">
 <SectionHead
 title="How the content engine works"
 sub="One conversation, every channel."
 />
 <div className="mt-8 grid gap-[13px] md:grid-cols-2 xl:grid-cols-4">
 {steps.map((s) => (
 <div key={s.n} className="rounded-[20px] bg-white p-7 shadow-[var(--shadow-card)]">
 <p className="display display-tight text-[1.75rem] tabular-nums text-amber-ink">{s.n}</p>
 <h3 className="display display-tight mt-4 text-display-s text-text">{s.title}</h3>
 <p className="mt-3 text-[0.875rem] leading-relaxed text-muted">{s.body}</p>
 </div>
 ))}
 </div>
 </section>

 <section className="shell pb-14">
 <SectionHead title="What one recording produces" />
 <div className="mt-7 overflow-hidden rounded-[20px] bg-white shadow-[var(--shadow-card)]">
 {formats.map(([name, len, note], i) => (
 <div
 key={name}
 className={`grid gap-3 px-7 py-6 md:grid-cols-[220px_160px_1fr] ${
 i > 0 ? "border-t border-hairline" : ""
 }`}
 >
 <p className="display display-tight text-body-l text-text">{name}</p>
 <p className="meta text-anchor">{len}</p>
 <p className="text-[0.875rem] text-muted">{note}</p>
 </div>
 ))}
 </div>
 </section>

 <section className="shell pb-14">
 <div className="on-deep grid gap-8 rounded-[24px] bg-cta-deep p-10 md:grid-cols-3">
 {[
 ["92%", "session completion", "Against a CME category average nearer 40%."],
 ["2.4M", "annual views", "Across video, podcast and editorial."],
 ["140+", "KOL faculty", "Practicing clinicians with their own audiences."],
 ].map(([n, l, note]) => (
 <div key={l}>
 <p className="display display-tight text-[2.625rem] tabular-nums text-amber">{n}</p>
 <p className="meta mt-2 text-white/70">{l}</p>
 <p className="mt-3 text-body-s leading-normal text-white/75">{note}</p>
 </div>
 ))}
 </div>
 </section>

 <section id="walkthrough" className="shell pb-16">
 <div className="grid gap-10 rounded-[24px] bg-white p-10 shadow-[var(--shadow-card)] lg:grid-cols-[1fr_26.25rem] lg:items-start">
 <div>
 <Eyebrow>Book a walkthrough</Eyebrow>
 <h2 className="display display-tight mt-3 text-[1.875rem] text-text">
 Thirty minutes, and we show you the back end.
 </h2>
 <p className="mt-4 max-w-[440px] text-body-m leading-relaxed text-muted">
 Completion curves by session, faculty reach by channel, and the placement map for
 your disease state. No deck.
 </p>
 </div>

 <WalkthroughForm />
 </div>
 </section>
 </>
 );
}
