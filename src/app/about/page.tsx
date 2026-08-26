import { audiences, capabilities } from "@/lib/platform";
import { Band, Button, Eyebrow, SectionHead } from "@/components/ui";
import { PageHead } from "@/components/page-head";
import { KolPanel } from "@/components/hero-panels";
import { Reveal } from "@/components/reveal";
import { Mark } from "@/components/mark";

export const metadata = { title: "About · CHM" };

/* Moved off the homepage: a position statement is what an About
   page is for. It helps nobody find a session. */
const beliefs = [
  {
    h: "Watch like a colleague",
    b: "Narrated slide decks lose people because that is not how anyone learns from a peer. Our sessions run like case discussions between colleagues, because that is exactly what they are.",
  },
  {
    h: "Trust what you hear",
    b: "Credentials, institutional affiliation and sourcing sit beside every contributor, on every screen. Credibility is a layout decision before it is a claim.",
  },
  {
    h: "See it land",
    b: "Completion rate and post-test pass rate, reported monthly. Not impressions. If a session is not being finished, that is our problem to fix.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHead
        eyebrow="About CHM"
        title="Medicine moves through shared knowledge"
        lede="Community Health Media is a full-service medical communications partner: expert-led content, strategic distribution and multichannel campaigns for healthcare. We connect organisations with HCPs, KOLs and patient communities through clinically credible communication."
        figure={<KolPanel />}
      />

      <Band labelledBy="belief-heading">
        <SectionHead
          id="belief-heading"
          index="01 / Position"
          title="What we believe"
          sub="Three commitments that decide how every session gets made."
        />
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {beliefs.map((b, i) => (
            <Reveal as="li" key={b.h} delay={i * 70}>
              <div className="card h-full p-7">
                <Mark className="size-6 text-signature" />
                <h3 className="display mt-5 text-body-l text-text">{b.h}</h3>
                <p className="prose-lede mt-3 text-body-m text-muted">{b.b}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      <Band labelledBy="audience-heading">
        <SectionHead
          id="audience-heading"
          index="02 / Audience"
          title="Who we reach"
          sub="Three groups, each meeting the same content on different terms."
        />
        <ul className="mt-12 space-y-3">
          {audiences.map((a, i) => (
            <Reveal as="li" key={a.label} delay={i * 60}>
              <div className="card grid gap-3 p-7 md:grid-cols-[12rem_1fr] md:gap-10">
                <p className="display text-display-s text-text">{a.label}</p>
                <p className="prose-lede text-body-m text-muted">{a.blurb}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      <Band labelledBy="cap-heading">
        <SectionHead
          id="cap-heading"
          index="03 / Platform"
          title="How we help organisations educate healthcare audiences"
        />
        <ul className="mt-12 space-y-3">
          {capabilities.map((c, i) => (
            <Reveal as="li" key={c.title} delay={i * 45}>
              <div className="card grid gap-3 p-7 md:grid-cols-[22rem_1fr] md:gap-10">
                <h3 className="display text-body-l text-text">{c.title}</h3>
                <p className="prose-lede text-body-m text-muted">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      <section id="contact" className="rail flex flex-wrap items-center justify-between gap-8 py-20">
        <div>
          <Eyebrow>Contact</Eyebrow>
          <h2 className="display mt-4 max-w-[22ch] text-display-m text-text">
            Faculty enquiries, partnerships and corrections
          </h2>
          <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted">
            All land in the same inbox, and a person reads it.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button href="/contact" variant="cta" withArrow>
            Talk to the team
          </Button>
          <Button href="/kol-network" variant="outline">
            See the KOL network
          </Button>
        </div>
      </section>
    </>
  );
}
