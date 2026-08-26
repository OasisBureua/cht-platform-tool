import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui";
import { audiences } from "@/lib/platform";

export const metadata = { title: "Contact · CHM" };

export default function ContactPage() {
 return (
 <>
 <PageHead
 eyebrow="Contact"
 title="Talk to the team"
 lede="Faculty enquiries, partnership questions, corrections and story pitches all land in the same inbox, and a person reads it."
 />
 <section className="">
 <div className="rail grid gap-14 py-16 lg:grid-cols-[1fr_26rem]">
 <div>
 <h2 className="display text-display-m text-text">Who we reach</h2>
 <ul className="mt-8 space-y-3 mt-2">
 {audiences.map((a) => (
 <li key={a.label} className="grid gap-2 py-6 md:grid-cols-[10rem_1fr]">
 <p className="display text-body-l text-text">{a.label}</p>
 <p className="prose-lede text-body-m text-muted">{a.blurb}</p>
 </li>
 ))}
 </ul>
 </div>

 <form action="/thanks" className="h-fit card p-7">
 <h2 className="display text-body-l text-text">Send a note</h2>
 <div className="mt-6 space-y-5">
 {[
 { id: "c-name", label: "Name", type: "text", ac: "name" },
 { id: "c-email", label: "Work email", type: "email", ac: "email" },
 { id: "c-org", label: "Organisation", type: "text", ac: "organization" },
 ].map((f) => (
 <div key={f.id}>
 <label htmlFor={f.id} className="mb-2 block text-body-s text-muted">
 {f.label}
 </label>
 <input
 id={f.id}
 name={f.id}
 type={f.type}
 autoComplete={f.ac}
 required
 className="h-11 w-full rounded-[6px] card bg-ground px-4 text-base text-text outline-none focus: sm:text-body-s"
 />
 </div>
 ))}
 <div>
 <label htmlFor="c-msg" className="mb-2 block text-body-s text-muted">
 What is this about?
 </label>
 <textarea
 id="c-msg"
 name="message"
 rows={4}
 required
 className="w-full rounded-[6px] card bg-ground p-4 text-base text-text outline-none focus: sm:text-body-s"
 />
 </div>
 <button
 type="submit"
 className="press h-11 w-full rounded-[6px] bg-signature text-body-s font-medium text-text hover:brightness-[0.94]"
 >
 Send
 </button>
 </div>
 </form>
 </div>
 </section>

 <section className="">
 <div className="rail flex flex-wrap items-center justify-between gap-8 py-16">
 <h2 className="display max-w-[24ch] text-display-m text-text">
 Practising, and want to record with us?
 </h2>
 <Button href="/kol-network" variant="outline" withArrow>
 See the KOL network
 </Button>
 </div>
 </section>
 </>
 );
}
