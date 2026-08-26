import { prettyDay, upcoming } from "@/lib/platform";
import { Band, Button, SectionHead, Thumb } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import { AbstractFigure } from "@/components/abstract-figure";
import { Reveal } from "@/components/reveal";

export const metadata = { title: "CHM Office Hours" };

const format = [
 {
 n: "01",
 title: "Send the case",
 body: "A short form, de-identified. The ones that get picked are the ones where reasonable people would disagree.",
 },
 {
 n: "02",
 title: "Two faculty take it live",
 body: "No prep deck, no rehearsal. They see the case at the same time the audience does.",
 },
 {
 n: "03",
 title: "The room asks back",
 body: "Questions go straight to the panel. The awkward ones are the point.",
 },
 {
 n: "04",
 title: "It gets cut and filed",
 body: "Chapters, an audio version and a written summary, filed under the relevant playlist within a week.",
 },
];

export default function OfficeHoursPage() {
 const next = upcoming()[0];

 return (
 <>
 <PageHead
 eyebrow="CHM Office Hours"
 title="An open line to the faculty"
 lede="Clinicians send the case they are stuck on. Two specialists work it live, without knowing the answer in advance. It is the least polished thing CHM makes and the most watched."
        figure={<AbstractFigure variant="conversation" />}
 >
 <div className="flex flex-wrap gap-3">
 <Button href="/join" withArrow>
 Submit a case
 </Button>
 <Button href="/live" variant="outline">
 See the schedule
 </Button>
 </div>
 </PageHead>

 <Band labelledBy="next-session">
 <div className="grid items-center gap-12 lg:grid-cols-2">
 <Reveal>
 <h2 id="next-session" className="display text-display-m text-text">
 Next session
 </h2>
 {next ? (
 <>
 <p className="display mt-6 text-display-s text-text">{next.title}</p>
 <p className="mt-2 text-body-m text-muted">{next.faculty}</p>
 <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-5 mt-2 pt-7">
 {[
 ["Date", prettyDay(next.date)],
 ["Time", next.time],
 ["Runs", next.duration],
 ].map(([k, v]) => (
 <div key={k}>
 <dt className="eyebrow text-faint">{k}</dt>
 <dd className="mt-1.5 text-body-m text-text tabular-nums">{v}</dd>
 </div>
 ))}
 </dl>
 <div className="mt-9">
 <Button href={`/live/${next.slug}`} withArrow>
 Register
 </Button>
 </div>
 </>
 ) : (
 <p className="prose-lede mt-6 text-body-m text-muted">
 Nothing on the calendar right now. The next block is announced by email.
 </p>
 )}
 </Reveal>

 <Reveal delay={80}>
 <Thumb src="/img/thumb-ild.jpg" duration="Live" className="aspect-video w-full" rounded="rounded-[6px]" />
 </Reveal>
 </div>
 </Band>

 <Band labelledBy="how-heading">
 <SectionHead id="how-heading" index="01 / Format" title="How a session runs" />
 <ul className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
 {format.map((f, i) => (
 <Reveal as="li" key={f.n} delay={i * 60}>
 <div className="h-full card p-6">
 <p className="display text-display-s tabular-nums text-accent">{f.n}</p>
 <h3 className="display mt-4 text-body-l text-text">{f.title}</h3>
 <p className="prose-lede mt-3 text-body-s text-muted">{f.body}</p>
 </div>
 </Reveal>
 ))}
 </ul>
 </Band>
 </>
 );
}
