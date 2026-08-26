import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Play,
  Search,
  LayoutGrid,
  Users,
  Shield,
  Stethoscope,
  Building2,
  Award,
  Radio,
  MessagesSquare,
  LineChart,
} from 'lucide-react';
import { Button, Card, Rail, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

const AUDIENCES = [
  {
    title: 'Physicians & healthcare professionals',
    body:
      'CHM provides access to trusted knowledge, expert perspectives, and peer discussion that support continuous professional development and informed clinical practice.',
    icon: <Stethoscope className="h-5 w-5" />,
  },
  {
    title: 'Healthcare organizations, pharma & industry',
    body:
      'CHM helps healthcare organizations connect with professional medical audiences through credible content, expert voices, and multichannel communication strategies that drive engagement and insight.',
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    title: 'KOLs & experts',
    body:
      'CHM offers a platform where experts can share their knowledge, contribute to professional dialogue, and amplify their impact across the medical community.',
    icon: <Award className="h-5 w-5" />,
  },
] as const;

const SHOW_UP = [
  {
    title: 'Credible medical education',
    body: 'Expert-led content designed for clinical credibility, not volume for its own sake.',
    icon: <Play className="h-5 w-5" />,
  },
  {
    title: 'Strategic distribution',
    body: 'Multichannel reach so important knowledge meets audiences where they already learn and engage.',
    icon: <Radio className="h-5 w-5" />,
  },
  {
    title: 'Community & dialogue',
    body: 'Formats that turn information into conversation among peers and stakeholders.',
    icon: <MessagesSquare className="h-5 w-5" />,
  },
  {
    title: 'Engagement & insight',
    body: 'Signals that help partners understand how professional audiences respond, learn, and stay informed.',
    icon: <LineChart className="h-5 w-5" />,
  },
] as const;

/**
 * The four pillars. Each one is a destination, so the whole card is the
 * link and the call to action renders as a label inside it: a card that
 * is already a link cannot carry a second one.
 */
const PILLARS = [
  {
    title: 'Curated Disease-Area Hubs',
    body: 'Treatment-specific pages organized by disease area and subtype, with structured collections.',
    icon: <LayoutGrid className="h-5 w-5" />,
    cta: { label: 'Browse Catalogue', to: '/catalog' },
  },
  {
    title: 'Short-form Video Learning',
    body: 'Focused videos designed for busy clinicians, with clear takeaways and practical framing.',
    icon: <Play className="h-5 w-5" />,
    cta: { label: 'Explore conversations', to: '/catalog' },
  },
  {
    title: 'Fast Discovery & Search',
    body: 'Search across topics, conditions, speakers, and collections with quick filters.',
    icon: <Search className="h-5 w-5" />,
    cta: { label: 'Go to Search', to: '/search' },
  },
  {
    title: 'Sharing & Team Learning',
    body: 'Make it easy to share relevant resources across your clinical team.',
    icon: <Users className="h-5 w-5" />,
    cta: { label: 'Explore Collections', to: '/catalog' },
  },
] as const;

/**
 * The three claims under the opening. A bare spec row rather than three
 * stat cards: the values are adjectives, and set at metric size they
 * read as a dashboard bolted to a marketing page.
 */
const HERO_SPECS = [
  { label: 'Collections', value: 'Curated' },
  { label: 'Videos', value: 'Short-form' },
  { label: 'Discovery', value: 'Fast' },
] as const;

const STEPS = [
  {
    step: '01',
    title: 'Discover',
    body: 'Browse the catalogue or search for a condition, topic, or speaker.',
  },
  {
    step: '02',
    title: 'Focus',
    body: 'Open a disease hub and choose the collection or playlist that matches your clinical question.',
  },
  {
    step: '03',
    title: 'Learn & share',
    body: 'Watch short-form video, then share links or playlists with colleagues for faster alignment.',
  },
] as const;

/** Display sizes from the type scale, as classes rather than tokens. */
const DISPLAY_L =
  'text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem]';
const DISPLAY_M =
  'text-[2rem] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-[2.25rem]';
const DISPLAY_S =
  'text-[1.375rem] font-semibold leading-[1.2] tracking-[-0.018em] text-foreground';

export default function WhatWeDo() {
  return (
    <div className="bg-background text-foreground">
      {/* ── Opening ──────────────────────────────────────────
          Copy on the left, one figure on the right. Separation
          between the two is the surface change on the figure,
          not a rule between the columns. */}
      <Band>
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-label uppercase text-muted-foreground">What we do</p>
              <h1 className={cn('mt-5 max-w-[24ch] text-balance md:text-[3.25rem]', DISPLAY_L)}>
                We organize clinical education into focused, easy-to-navigate experiences
              </h1>
              <p className="mt-6 max-w-[54ch] text-pretty text-lg leading-relaxed text-muted-foreground">
                Community Health Media delivers expert-led medical communications: content, distribution, and
                engagement across healthcare. Our public platform helps clinicians discover
                treatment-specific material, learn through short-form video, and explore curated collections built
                around disease areas and subtypes.
              </p>
            </Reveal>

            <Reveal delay={60}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button to="/catalog" size="lg">
                  Explore Catalogue
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button to="/search" variant="outline" size="lg">
                  Search Content
                </Button>
              </div>
            </Reveal>

            <Reveal delay={120}>
              <dl className="mt-12 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
                {HERO_SPECS.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-label uppercase text-muted-foreground">{label}</dt>
                    <dd className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <div className="lg:col-span-5">
            <Reveal delay={180}>
              <Card className="overflow-hidden p-0">
                <div
                  className="relative h-[300px] w-full bg-cover bg-center md:h-[360px]"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1800&q=80')",
                  }}
                >
                  {/* A scrim, not a curtain: the photograph should still read. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                </div>
                <div className="p-6">
                  <p className="text-base font-semibold text-foreground">Built to support modern clinical workflows</p>
                  <p className="mt-2 max-w-[46ch] leading-relaxed text-muted-foreground">
                    Browse disease hubs, curated conversations and videos, and share relevant content with your team.
                  </p>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </Band>

      {/* ── Who we serve ─────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="01 / Audiences"
            title="Who we serve"
            sub="Different audiences need different promises. Here is how CHM shows up for each."
          />
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {AUDIENCES.map(({ title, body, icon }, i) => (
            <li key={title}>
              <Reveal delay={i * 60} className="h-full">
                <Card className="flex h-full flex-col">
                  <Medallion>{icon}</Medallion>
                  <h3 className={cn('mt-5 text-balance', DISPLAY_S)}>{title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── How we show up ───────────────────────────────────
          Four statements, no surface under them. The band before
          this one is a row of cards, so this one is bare ground:
          the alternation is what separates the two. */}
      <Band>
        <Reveal>
          <SectionHead
            index="02 / Approach"
            title="How we show up"
            sub="A concise view of the work behind the scenes, before someone ever hits play."
          />
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-x-12 gap-y-10 md:grid-cols-2">
          {SHOW_UP.map(({ title, body, icon }, i) => (
            <li key={title}>
              <Reveal delay={i * 60}>
                <div className="flex gap-5">
                  <Medallion>{icon}</Medallion>
                  <div className="min-w-0">
                    <h3 className={cn('text-balance', DISPLAY_S)}>{title}</h3>
                    <p className="mt-2 max-w-[46ch] leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── The four pillars ─────────────────────────────────
          Every pillar leads somewhere, so they browse rather than
          stack: a rail that runs off the viewport edge on a phone
          and settles into a row on a desktop. */}
      <Band>
        <Reveal>
          <SectionHead
            index="03 / Platform"
            title="Our platform focuses on four things"
            sub="A simple, structured system to make clinical learning easier to discover and faster to consume."
          />
        </Reveal>
        <div className="mt-12">
          <Rail aria-label="What the platform focuses on">
            {PILLARS.map(({ title, body, icon, cta }, i) => (
              <li
                key={title}
                className="w-[80%] shrink-0 snap-start sm:w-[46%] lg:w-[23.5%]"
              >
                <Reveal delay={i * 60} className="h-full">
                  <Card to={cta.to} className="flex h-full flex-col">
                    <Medallion>{icon}</Medallion>
                    <h3 className={cn('mt-5 text-balance', DISPLAY_S)}>{title}</h3>
                    <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand-600">
                      {cta.label}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </Card>
                </Reveal>
              </li>
            ))}
          </Rail>
        </div>
      </Band>

      {/* ── How it works ─────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="04 / Path"
            title="How it works"
            sub="A clear path from discovery to learning."
          />
        </Reveal>
        <ol className="mt-12 grid grid-cols-1 gap-x-12 gap-y-12 md:grid-cols-3">
          {STEPS.map(({ step, title, body }, i) => (
            <li key={step}>
              <Reveal delay={i * 60}>
                <p className="font-mono text-4xl tabular-nums leading-none text-muted-foreground">{step}</p>
                <h3 className={cn('mt-5', DISPLAY_S)}>{title}</h3>
                <p className="mt-3 max-w-[46ch] leading-relaxed text-muted-foreground">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Band>

      {/* ── Closing ──────────────────────────────────────── */}
      <Band>
        <Reveal>
          <Card className="grid grid-cols-1 items-center gap-10 bg-muted p-8 md:p-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center gap-2 text-foreground">
                <Shield className="h-5 w-5" />
                <p className="text-base font-semibold">Built with clarity in mind</p>
              </div>
              <h2 className={cn('mt-5 max-w-[18ch] text-balance', DISPLAY_M)}>
                Structured content experiences, ready to scale
              </h2>
              <p className="mt-5 max-w-[54ch] text-lg leading-relaxed text-muted-foreground">
                Read{' '}
                <Link
                  to="/about"
                  className="font-semibold text-foreground underline decoration-muted-foreground/40 underline-offset-4 transition-colors duration-150 hover:decoration-foreground"
                >
                  About
                </Link>{' '}
                for the full CHM story, formats, and what we stand for. For programs, partnerships, or platform
                questions, contact us.
              </p>
            </div>

            {/* Both actions take one width so the stack has a straight
                edge; a ragged pair of buttons reads as an accident. */}
            <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end">
              <Button to="/join" size="lg" className="w-full sm:w-auto sm:min-w-[13rem]">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button to="/contact" variant="outline" size="lg" className="w-full sm:w-auto sm:min-w-[13rem]">
                Contact Us
              </Button>
            </div>
          </Card>
        </Reveal>
      </Band>
    </div>
  );
}

/**
 * One content section. Space separates the bands; there is no rule
 * between them. The inner rail carries the page gutter, which is the
 * same variable `bleed-x` cancels, so a rail inside a band reaches the
 * viewport edge exactly.
 */
function Band({ children }: { children: ReactNode }) {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">{children}</div>
    </section>
  );
}

/** The icon plate. Square with a slight corner, matching every control. */
function Medallion({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-[6px] bg-muted text-brand-600">
      {children}
    </span>
  );
}

/**
 * Whether this visit gets scroll entrances at all. Decided during the
 * first render rather than inside an effect, so content is never hidden
 * for a frame on a browser that cannot un-hide it.
 */
function motionAllowed() {
  return (
    typeof window !== 'undefined' &&
    typeof IntersectionObserver !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  );
}

/**
 * Scroll entrance: opacity and a 2px lift, nothing more.
 *
 * It fails open. Without an observer, or with reduced motion asked for,
 * the block renders shown on the very first pass — the one way a reveal
 * can genuinely break a page is by leaving content invisible.
 */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed] = useState(motionAllowed);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!armed || !el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  const shown = !armed || seen;

  return (
    <div
      ref={ref}
      data-shown={shown}
      style={shown ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0,0,0.2,1)]',
        'motion-safe:data-[shown=false]:translate-y-[2px] motion-safe:data-[shown=false]:opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
