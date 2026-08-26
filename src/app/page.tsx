import Link from "next/link";
import { kols } from "@/lib/platform";
import {
 articles,
 biomarkers,
 diseaseAreas,
 playlists,
 prettyDay,
 shows,
 upcoming,
} from "@/lib/platform";
import { byNewest, items } from "@/lib/data";
import { Mark } from "@/components/mark";
import { ArrowRight, PlayIcon } from "@/components/icons";
import { Band, Button, CompactCard, Eyebrow, SectionHead, Thumb } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { AreaRail } from "@/components/area-rail";
import { ShowCarousel } from "@/components/show-carousel";
import { HeroMarquee } from "@/components/hero-marquee";
import { SessionWidget, StatGrid } from "@/components/showcase";

const moments = [
 { t: "Oncotype or Prosigna, which is more informative?", d: "4:12" },
 { t: "Neoadjuvant or adjuvant T-DXd?", d: "3:48" },
 { t: "First-line HER2+ metastatic breast cancer", d: "5:20" },
 { t: "Do BRCA patients benefit from ADCs?", d: "4:02" },
];

const beliefs = [
 { h: "Watch like a colleague", b: "Sessions run like case discussions between peers, because that is exactly what they are." },
 { h: "Trust what you hear", b: "Credentials and affiliations sit beside every contributor, on every screen." },
 { h: "See it land", b: "Completion, not impressions. Reported monthly to the organisations who fund it." },
];

/* The faculty row is a row of portraits, so it leads with the people
   who have one. The initials fallback below still has to look
   deliberate, because the directory page shows everyone. */
const portraitFirst = [...kols].sort((a, b) => Number(!!b.photo) - Number(!!a.photo));

const INITIAL_TONES = [
  "var(--color-cyan)",
  "var(--color-pink)",
  "var(--color-purple)",
  "var(--color-coral)",
  "var(--color-glow)",
];

export default function Home() {
 const latest = byNewest(items);
 const next = upcoming()[0];

 return (
 <>
 {/* ── Hero ─────────────────────────────────────────── */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden">
        <HeroMarquee />
        <div className="rail relative flex flex-col items-center pt-20 pb-24 text-center md:pt-28 md:pb-32">
          <h1
            id="hero-heading"
            className="rise display max-w-[16ch] text-[2.75rem] leading-[1.03] tracking-[-0.032em] text-text sm:text-[3.5rem] lg:text-[4.25rem]"
          >
            Medicine moves through <span className="shimmer">shared knowledge</span>.
          </h1>

          <p
            className="rise prose-lede mt-7 max-w-[48ch] text-body-l text-muted"
            style={{ animationDelay: "100ms" }}
          >
            Expert video, podcasts and editorial for oncology, organised by disease state and by
            format, so you can browse the way you actually work.
          </p>

          <div
            className="rise mt-10 flex flex-wrap justify-center gap-3"
            style={{ animationDelay: "200ms" }}
          >
            <Button href="/join" variant="cta" withArrow>
              Start watching free
            </Button>
            <Button href="/contact" variant="outline">
              Partner with CHM
            </Button>
          </div>
        </div>
      </section>

 {/* ── Now on CHM ───────────────────────────────────── */}
 <Band labelledBy="now-heading">
 <SectionHead
 id="now-heading"
 index="01 / Latest"
 title="Now on CHM"
 sub="The most recent across every format."
 seeAll={{ noun: "content", href: "/catalog" }}
 />
 <Reveal className="mt-12">
          {/* The rail reveals as one block. Revealing each card meant
              anything scrolled off to the right never intersected the
              viewport, so it stayed blank until you swiped it in, and a
              per-card stagger fights the swipe anyway. */}
          <div className="scrollbar-none bleed-x overflow-x-auto">
            <ul className="flex snap-x snap-mandatory gap-4">
              {latest.slice(0, 8).map((item) => (
                <li key={item.slug} className="w-[80%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[22.5%]">
                  <CompactCard item={item} />
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
 </Band>

 {/* ── Showcase / content engine ────────────────────── */}
 <Band labelledBy="engine-heading">
 <div className="grid items-center gap-14 lg:grid-cols-2">
 <Reveal>
 <Eyebrow>02 / The model</Eyebrow>
 <h2 id="engine-heading" className="display mt-5 text-display-l">
 <span className="block text-text">One recording.</span>
 <span className="block text-muted">Four formats.</span>
 </h2>
 <p className="prose-lede mt-6 max-w-[44ch] text-body-l text-muted">
 A single peer-to-peer conversation becomes a long-form interview, a podcast episode, a
 written explainer and a set of short clips, each filed under the same disease state.
 </p>
 <div className="mt-9 flex flex-wrap gap-3">
 <Button href="/contact" variant="cta" withArrow>
 Partner with CHM
 </Button>
 <Button href="/catalog" variant="outline">
 Browse the library
 </Button>
 </div>
 </Reveal>

 <Reveal delay={80}>
 <SessionWidget />
 </Reveal>
 </div>
 </Band>

 {/* ── Podcast network ──────────────────────────────── */}
 <Band labelledBy="shows-heading">
 <SectionHead
 id="shows-heading"
 index="03 / Podcasts"
 title="CHM Podcast Network"
 sub="Four shows, each with its own voice and its own audience."
 seeAll={{ noun: "shows", href: "/chm-office-hours" }}
 />
 <div className="mt-12">
          <ShowCarousel />
        </div>
 </Band>

 {/* ── This Moment in Medicine ──────────────────────── */}
 <Band labelledBy="moment-heading">
 <SectionHead
 id="moment-heading"
 index="04 / Series"
 title="This Moment in Medicine"
 sub="Short answers to the questions that come up between patients."
 seeAll={{ noun: "episodes", href: "/catalog" }}
 />
 <ol className="mt-12 grid gap-3 lg:grid-cols-2">
          {moments.map((m, i) => (
            <Reveal as="li" key={m.t} delay={i * 55}>
              <Link
                href="/catalog"
                className="press card group flex items-center gap-5 p-3 ps-5"
              >
                <span className="meta w-6 shrink-0 tabular-nums text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="display block text-body-m text-text">{m.t}</span>
                  <span className="meta mt-1 block tabular-nums text-faint">{m.d}</span>
                </span>
                <Thumb
                  src={latest[i % latest.length].thumb}
                  className="hidden h-16 w-28 shrink-0 sm:block"
                />
              </Link>
            </Reveal>
          ))}
        </ol>
 </Band>

 {/* ── Editorial ────────────────────────────────────── */}
 <Band labelledBy="articles-heading">
 <SectionHead
 id="articles-heading"
 index="05 / Editorial"
 title="Recent articles"
 seeAll={{ noun: "articles", href: "/catalog" }}
 />
 <ul className="mt-12 space-y-3 mt-2">
 {articles.map((a, i) => (
 <Reveal as="li" key={a.slug} delay={i * 45}>
 <Link
 href="/catalog"
 className="press group grid items-baseline gap-x-8 gap-y-2 py-7 md:grid-cols-[9rem_1fr_5rem]"
 >
 <span className="eyebrow text-amber-ink">{a.kicker}</span>
 <span>
 <h3 className="display text-display-s text-text">{a.title}</h3>
 <p className="prose-lede mt-2 max-w-[62ch] text-body-s text-muted">{a.dek}</p>
 </span>
 <span className="meta text-faint md:text-end">{a.read}</span>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>

 {/* ── In conversation ──────────────────────────────── */}
 <Band labelledBy="kol-heading">
 <SectionHead
 id="kol-heading"
 index="06 / Faculty"
 title="In conversation"
 sub="Practising specialists who bring their own audiences."
 seeAll={{ noun: "profiles", href: "/kol-network" }}
 />
 <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
 {portraitFirst.slice(0, 5).map((k, i) => (
 <Reveal as="li" key={k.slug} delay={i * 50}>
 <Link href={`/kol-network/${k.slug}`} className="press group block">
 {k.photo ? (
 /* eslint-disable-next-line @next/next/no-img-element */
 <img src={k.photo} alt="" className="img-ring size-24 rounded-full object-cover md:size-28" />
 ) : (
 <span
                      aria-hidden
                      className="display grid size-24 place-items-center rounded-full text-body-l md:size-28"
                      style={{
                        background: INITIAL_TONES[i % INITIAL_TONES.length],
                        color: "var(--color-on-bright)",
                      }}
                    >
                      {k.name.replace("Dr. ", "").split(" ").map((w) => w[0]).join("")}
                    </span>
 )}
 <span className="display mt-4 block text-body-m text-text group-hover:text-anchor">{k.name}</span>
 <span className="mt-1 block text-body-s text-muted">{k.institution}</span>
 </Link>
 </Reveal>
 ))}
 </ul>
 </Band>

 {/* ── Explore by disease state ─────────────────────── */}
 <Band labelledBy="areas-heading">
 <SectionHead
 id="areas-heading"
 index="07 / Browse"
 title="Explore by disease state"
 sub="Six clinical areas at launch, each with its own colour through the library."
 />
        <div className="mt-12">
          <AreaRail />
        </div>

 <div className="mt-8 flex flex-wrap gap-2">
 {biomarkers.map((b) => (
 <Link
 key={b.slug}
 href={`/catalog?biomarker=${b.slug}`}
 className="press inline-flex h-9 items-center gap-2 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)]"
 >
 {b.label}
 <span className="meta text-faint">{b.count}</span>
 </Link>
 ))}
 </div>
 </Band>

 {/* ── Stat band ────────────────────────────────────── */}
 <section aria-labelledby="stats-heading" className="relative overflow-hidden">
 <StatGrid />
 <div className="rail relative py-20 md:py-28">
 <h2 id="stats-heading" className="sr-only">CHM by the numbers</h2>
 <dl className="grid gap-14 text-center md:grid-cols-3 md:gap-8">
 {[
 { n: "92%", l: "of sessions get finished" },
 { n: "2.4M", l: "views a year" },
 { n: "140+", l: "practising faculty" },
 ].map((s, i) => (
 <Reveal key={s.l} delay={i * 80}>
 <dt className="sr-only">{s.l}</dt>
 <dd>
 <span className="display block text-[3.25rem] leading-none tracking-[-0.04em] tabular-nums text-text md:text-[4.5rem]">
 {s.n}
 </span>
 <span className="mt-5 block text-body-m text-muted">{s.l}</span>
 </dd>
 </Reveal>
 ))}
 </dl>
 </div>
 </section>

 {/* ── Get started ──────────────────────────────────── */}
      <section aria-labelledby="start-heading">
        <div className="rail flex flex-col items-center py-24 text-center">
          <h2
            id="start-heading"
            className="display max-w-[18ch] text-display-l text-text"
          >
            Free for clinicians. Always.
          </h2>
          <p className="prose-lede mt-5 max-w-[46ch] text-body-l text-muted">
            Create an account to save your place, claim credit and get one email a week.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button href="/join" variant="cta" withArrow>
              Start watching free
            </Button>
            <Button href="/for-hcps" variant="outline">
              For HCPs
            </Button>
          </div>
        </div>
      </section>
 </>
 );
}
