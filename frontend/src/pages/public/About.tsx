import { useMemo, type ReactNode } from 'react';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button, Card, Reveal, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';
import { useKolDirectory, type DolEntry } from '../../hooks/useKolDirectory';

/**
 * Transplanted from chm-composio's `/about`. Every heading, sentence and
 * section order below is that page's, not the old platform About copy.
 *
 * The one substitution is the hero figure: the design fakes the KOL
 * directory panel from a static array, and this platform has the real
 * directory behind `useKolDirectory`, so the panel renders live faculty.
 */

/* Moved off the homepage: a position statement is what an About
   page is for. It helps nobody find a session. */
const BELIEFS = [
  {
    h: 'Watch like a colleague',
    b: 'Narrated slide decks lose people because that is not how anyone learns from a peer. Our sessions run like case discussions between colleagues, because that is exactly what they are.',
  },
  {
    h: 'Trust what you hear',
    b: 'Credentials, institutional affiliation and sourcing sit beside every contributor, on every screen. Credibility is a layout decision before it is a claim.',
  },
  {
    h: 'See it land',
    b: 'Completion rate and post-test pass rate, reported monthly. Not impressions. If a session is not being finished, that is our problem to fix.',
  },
] as const;

const AUDIENCES = [
  { label: 'HCPs', blurb: 'Beyond conferences and CME, where they actually consume content.' },
  { label: 'Patients', blurb: 'Pre- or active treatment, searching for credible information.' },
  { label: 'Caregivers', blurb: 'Making decisions, seeking guidance, needing support.' },
] as const;

const CAPABILITIES = [
  {
    title: 'AI-powered content automation',
    body: 'One recording becomes long-form video, an audio cut, a written explainer and a set of short clips, without a second production day.',
  },
  {
    title: 'Multi-audience reach',
    body: 'The same clinical conversation, versioned for HCPs, patients and caregivers, each on the surface they already use.',
  },
  {
    title: 'Entertainment-grade distribution',
    body: 'Published where attention already is, not parked behind a portal login nobody returns to.',
  },
  {
    title: 'First-party HCP intelligence',
    body: 'Who watched, how far they got, and which specialty they practise in. Consented and first-party.',
  },
  {
    title: 'Real engagement analytics',
    body: 'Completion rate and post-test pass rate, reported monthly. Not impressions.',
  },
] as const;

export default function About() {
  return (
    <div className="bg-background">
      <PageHead
        eyebrow="About CHM"
        title="Medicine moves through shared knowledge"
        lede="Community Health Media is a full-service medical communications partner: expert-led content, strategic distribution and multichannel campaigns for healthcare. We connect organisations with HCPs, KOLs and patient communities through clinically credible communication."
        figure={<KolPanel />}
      />

      <Band label="What we believe">
        <Reveal>
          <SectionHead
            index="01 / Position"
            title="What we believe"
            sub="Three commitments that decide how every session gets made."
          />
        </Reveal>
        <ul className="mt-12 grid gap-8 md:grid-cols-3">
          {BELIEFS.map((b, i) => (
            <Reveal as="li" key={b.h} delay={i * 70}>
              <div className="card h-full p-7">
                <ChmMark className="size-6 text-signature" />
                <h3 className="display mt-5 text-body-l text-text">{b.h}</h3>
                <p className="prose-lede mt-3 text-body-m text-muted2">{b.b}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      <Band label="Who we reach">
        <Reveal>
          <SectionHead
            index="02 / Audience"
            title="Who we reach"
            sub="Three groups, each meeting the same content on different terms."
          />
        </Reveal>
        <ul className="mt-12 space-y-3">
          {AUDIENCES.map((a, i) => (
            <Reveal as="li" key={a.label} delay={i * 60}>
              <div className="card grid gap-3 p-7 md:grid-cols-[12rem_1fr] md:gap-10">
                <p className="display text-display-s text-text">{a.label}</p>
                <p className="prose-lede text-body-m text-muted2">{a.blurb}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      <Band label="How we help organisations educate healthcare audiences">
        <Reveal>
          <SectionHead
            index="03 / Platform"
            title="How we help organisations educate healthcare audiences"
          />
        </Reveal>
        <ul className="mt-12 space-y-3">
          {CAPABILITIES.map((c, i) => (
            <Reveal as="li" key={c.title} delay={i * 45}>
              <div className="card grid gap-3 p-7 md:grid-cols-[22rem_1fr] md:gap-10">
                <h3 className="display text-body-l text-text">{c.title}</h3>
                <p className="prose-lede text-body-m text-muted2">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Band>

      {/* ── How the content engine works ─────────────────── */}
      <Band label="How the content engine works">
        <Reveal>
          <SectionHead
            index="04 / Engine"
            title="How the content engine works"
            sub="One conversation, every channel."
          />
        </Reveal>
        <ul className="mt-8 grid gap-[13px] md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((st, i) => (
            <Reveal as="li" key={st.n} delay={i * 60} className="h-full">
              <Card className="h-full p-7">
                <p className="display display-tight text-[1.75rem] tabular-nums text-anchor">
                  {st.n}
                </p>
                <h3 className="display display-tight mt-4 text-display-s text-text">{st.title}</h3>
                <p className="prose-lede mt-3 text-body-s text-muted2">{st.body}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Band>

      {/* ── What one recording produces ──────────────────── */}
      <Band label="What one recording produces">
        <Reveal>
          <SectionHead index="05 / Output" title="What one recording produces" />
        </Reveal>
        <Reveal delay={60}>
          <Card className="mt-7 overflow-hidden p-0">
            {FORMATS.map(([name, len, note], i) => (
              <div
                key={name}
                className={cn(
                  'grid gap-3 px-7 py-6 md:grid-cols-[220px_160px_1fr]',
                  i > 0 && 'border-t border-hairline',
                )}
              >
                <p className="display text-body-l text-text">{name}</p>
                <p className="meta text-anchor">{len}</p>
                <p className="text-body-s text-muted2">{note}</p>
              </div>
            ))}
          </Card>
        </Reveal>
      </Band>

      <section id="contact" className="rail flex flex-wrap items-center justify-between gap-8 py-20">
        <div>
          <p className="eyebrow text-muted2">Contact</p>
          <h2 className="display mt-4 max-w-[22ch] text-display-m text-text">
            Faculty enquiries, partnerships and corrections
          </h2>
          <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted2">
            All land in the same inbox, and a person reads it.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button to="/contact">Talk to the team</Button>
          <Button to="/kol-network" variant="outline">
            See the KOL network
          </Button>
        </div>
      </section>
    </div>
  );
}

/**
 * Inner-page masthead. When a `figure` is supplied the hero splits into
 * copy on the leading side and a raised product panel on the trailing
 * side, matching the homepage's weight.
 */
function PageHead({
  eyebrow,
  title,
  lede,
  figure,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  figure?: ReactNode;
}) {
  const copy = (
    <>
      <p className="eyebrow text-muted2">{eyebrow}</p>
      <h1 className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
        {title}
      </h1>
      {lede ? <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">{lede}</p> : null}
    </>
  );

  if (!figure) {
    return <section className="rail pb-14 pt-16 md:pb-16 md:pt-20">{copy}</section>;
  }

  return (
    <section className="rail pb-12 pt-14 md:pb-16 md:pt-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
        <div>{copy}</div>
        <div>{figure}</div>
      </div>
    </section>
  );
}

/** Full-bleed band; the inner rail carries the page margins. */
/* Lifted from the former /what-we-do, unchanged. */
const STEPS = [
  {
    n: '01',
    title: 'One conversation',
    body: 'Two faculty who already disagree sit down for ninety minutes on a question your brand has a stake in. No slides, no script approval, no talking points.',
  },
  {
    n: '02',
    title: 'Four channels',
    body: 'That session becomes long-form video, a podcast episode, an editorial explainer and a set of short clips. One recording day, four distribution surfaces.',
  },
  {
    n: '03',
    title: 'Placed in the track',
    body: 'Everything lands inside the disease state where your audience already browses, next to the sessions they came for.',
  },
  {
    n: '04',
    title: 'Measured on completion',
    body: 'Not impressions. Completion rate, post-test pass rate and repeat visits by faculty, reported monthly.',
  },
] as const;

const FORMATS = [
  ['Long-form video', '18 to 30 min', 'The full case discussion, chaptered.'],
  ['Podcast episode', '25 to 40 min', 'Audio cut, syndicated across the four CHM shows.'],
  ['Editorial explainer', '5 to 8 min read', 'Written by faculty, not by a medical writer.'],
  ['Short clips', '45 to 90 sec', 'Cut for social and for in-feed placement.'],
] as const;

function Band({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section aria-label={label}>
      <div className="rail py-16 md:py-24">{children}</div>
    </section>
  );
}

/**
 * Shared frame for the hero visual: a raised panel on a soft brand-tinted
 * field, with a bevel highlight along the top edge. Depth only, no
 * outlines. The design's gradient named two colours this platform does
 * not carry, so it is re-expressed on `signature` and `anchor`.
 */
function HeroPanel({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="relative">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[24px] opacity-80 blur-2xl"
        style={{
          background:
            'radial-gradient(50% 50% at 70% 30%, hsl(var(--signature) / 0.30), transparent 70%), radial-gradient(45% 45% at 25% 75%, hsl(var(--anchor) / 0.24), transparent 70%)',
        }}
      />
      <div className="relative overflow-hidden rounded-[6px] bg-surface p-3 shadow-pop">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="overflow-hidden rounded-[6px] bg-ground">{children}</div>
      </div>
    </div>
  );
}

function Chrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface px-4 py-3">
      <span className="size-2.5 rounded-full bg-surface-2" />
      <span className="size-2.5 rounded-full bg-surface-2" />
      <span className="size-2.5 rounded-full bg-surface-2" />
      <span className="meta ms-2 text-faint">{label}</span>
    </div>
  );
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * The KOL directory as the product shot. The design mocks four rows from
 * a static array; here they are the first four entries the public
 * directory actually returns, and the badge is its real total.
 *
 * Decorative: the real directory is a page away, so the panel stays out
 * of the accessibility tree rather than duplicating it.
 */
function KolPanel() {
  const directory = useKolDirectory({ surface: 'public' });

  const rows = useMemo(
    () =>
      directory.regions
        .flatMap((r) => r.entries.map((e) => ({ ...e, stateId: r.id })))
        .slice(0, 4),
    [directory.regions],
  );

  const count = directory.total > 0 ? String(directory.total) : '—';

  return (
    <HeroPanel>
      <Chrome label="chm / kol-network" />
      <div className="p-4">
        <div className="flex gap-2">
          <span className="flex h-9 flex-1 items-center rounded-[6px] bg-surface px-3 text-body-s text-faint">
            Search name or institution
          </span>
          <span className="flex h-9 items-center rounded-[6px] bg-anchor px-3 text-body-s tabular-nums text-ground">
            {count}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {/* Four rows either way: the panel is part of the hero's
              composition and must not resize while the query settles. */}
          {rows.length > 0
            ? rows.map((k: DolEntry & { stateId: string }) => (
                <li key={k.id} className="flex items-center gap-3 rounded-[6px] bg-surface p-3">
                  {k.photoUrl ? (
                    <img
                      src={k.photoUrl}
                      alt=""
                      className="size-9 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.625rem] text-muted2">
                      {initials(k.name)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-s font-medium text-text">
                      {k.name}
                    </span>
                    <span className="meta mt-0.5 block truncate text-faint">
                      {k.institution || k.role}
                    </span>
                  </span>
                  <span className="meta shrink-0 rounded-[6px] bg-surface-2 px-2 py-1 text-muted2">
                    {k.stateId.slice(0, 2).toUpperCase()}
                  </span>
                </li>
              ))
            : [0, 1, 2, 3].map((i) => (
                <li key={i} className="flex items-center gap-3 rounded-[6px] bg-surface p-3">
                  <span className="size-9 shrink-0 rounded-full bg-surface-2" />
                  <span className="min-w-0 flex-1">
                    <span className="block h-3 w-2/3 rounded-[3px] bg-surface-2" />
                    <span className="mt-2 block h-2.5 w-1/2 rounded-[3px] bg-surface-2" />
                  </span>
                </li>
              ))}
        </ul>
      </div>
    </HeroPanel>
  );
}
