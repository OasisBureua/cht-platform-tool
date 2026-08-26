import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button, Card, Rail, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

const FORMATS = [
  'Peer-to-peer interviews, expert panels, and roundtables',
  'Medical events, conferences, and live experiences',
  'In-depth medical content and research updates',
  'Interactive learning modules and accredited webinars',
  'Live and on-demand webcasts and podcasts',
] as const;

const CORE_PILLARS = [
  {
    title: 'Trusted medical knowledge',
    body:
      'We connect expert knowledge with the professional communities that use it, so medical knowledge reaches the right audiences and shows how medicine learns and evolves.',
  },
  {
    title: 'Professional community',
    body:
      'We bring together physicians, experts, and healthcare stakeholders so knowledge and perspective actually get exchanged.',
  },
  {
    title: 'Engagement that generates insight',
    body:
      'Through expert-driven content, discussion, and live sessions, we capture engagement data that shows organizations how medical audiences learn and respond.',
  },
] as const;

/**
 * The three narrative claims that sit under the positioning line. They
 * were four stacked paragraphs; the fourth is now the band's heading,
 * so these three read as parallel support for it.
 */
const APPROACH = [
  'We help healthcare organizations, pharmaceutical companies, and medical brands connect with healthcare professionals (HCPs), key opinion leaders (KOLs), and patient communities through clinically credible communication.',
  'Our approach combines medical content production with targeted distribution, so important knowledge reaches the right clinicians while it still matters to their practice.',
  'We treat content, community, and data as one system rather than three separate services. That is what sets this apart from traditional medical communications: engagement you can measure, and insight you can act on.',
] as const;

/**
 * A full-width section whose inner rail carries the page gutter. Space
 * separates bands; there is no rule between them.
 */
function Band({
  children,
  className,
  tinted = false,
}: {
  children: ReactNode;
  className?: string;
  tinted?: boolean;
}) {
  return (
    <section className={cn(tinted && 'bg-muted')}>
      <div className={cn('mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8', className)}>
        {children}
      </div>
    </section>
  );
}

/**
 * Scroll reveal: opacity plus a 2px lift, nothing more. If the observer
 * cannot run, or motion is reduced, the block is shown immediately —
 * content must never be able to get stuck invisible.
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
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      !window.matchMedia('(prefers-reduced-motion: no-preference)').matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : undefined }}
      className={cn(
        'transition-[opacity,translate] duration-500 ease-[cubic-bezier(0,0,0.2,1)]',
        'motion-reduce:transition-none',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-0.5 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function About() {
  return (
    <div className="bg-background">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 md:pb-16 md:pt-24 lg:px-8">
          <Reveal className="max-w-3xl">
            <p className="text-label uppercase text-muted-foreground">Community Health Media</p>
            <h1 className="mt-4 text-balance text-[2.75rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem] md:text-[3.5rem]">
              About Us
            </h1>
            <p className="mt-6 max-w-[54ch] text-pretty text-lg leading-relaxed text-muted-foreground md:text-xl">
              Community Health Media (CHM) is a full-service medical communications partner specializing in
              expert-led content, strategic distribution, and multichannel campaigns for the healthcare industry.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── 01 / Mission ───────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="01 / Mission"
            title="What we stand for"
            sub="CHM produces credible, expert-driven medical content designed to inform healthcare professionals and support continuous learning as clinical practice changes."
            action={
              <Button
                to="/what-we-do"
                variant="outline"
                size="sm"
                className="h-auto min-h-9 max-w-full py-2 text-left"
              >
                How we serve different audiences and the platform
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            }
          />
        </Reveal>

        <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          {CORE_PILLARS.map(({ title, body }, i) => (
            <li key={title} className="flex">
              <Reveal delay={i * 60} className="flex w-full">
                <Card className="flex h-full w-full flex-col gap-3">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-lg font-semibold leading-snug tracking-tight text-foreground">
                    {title}
                  </p>
                  <p className="max-w-[54ch] text-base leading-relaxed text-muted-foreground">{body}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── 02 / Approach ──────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="02 / Approach"
            title="Community Health Media turns medical knowledge into measurable impact."
          />
        </Reveal>

        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
          {APPROACH.map((para, i) => (
            <li key={para}>
              <Reveal delay={i * 60}>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <p className="mt-3 max-w-[54ch] text-base leading-relaxed text-muted-foreground md:text-lg">
                  {para}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── 03 / Formats ───────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="03 / Formats"
            title="Formats we deliver"
            sub="CHM develops and delivers a wide range of medical education and communication formats, including:"
          />
        </Reveal>

        <div className="mt-12">
          {/* Mandatory snap otherwise pulls the first card past the bleed
              padding and flush to the viewport edge; the scroll padding
              puts the snapport start back on the page gutter. */}
          <Rail
            aria-label="Formats we deliver"
            className="[scroll-padding-inline:var(--page-gutter)]"
          >
            {FORMATS.map((item, i) => (
              <li
                key={item}
                className="w-[76%] shrink-0 snap-start sm:w-[46%] md:w-[31%] lg:w-[23%]"
              >
                <Reveal delay={i * 60} className="h-full">
                  <Card className="flex h-full flex-col gap-4">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-base leading-relaxed text-foreground">{item}</p>
                  </Card>
                </Reveal>
              </li>
            ))}
          </Rail>
        </div>
      </Band>

      {/* ── Explore the platform ───────────────────────────── */}
      <Band tinted className="text-center">
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center">
          <h2 className="text-balance text-[2.25rem] font-semibold leading-[1.08] tracking-[-0.025em] text-foreground md:text-[3rem] md:leading-[1.05] md:tracking-[-0.028em]">
            Explore the platform
          </h2>
          <p className="mt-5 max-w-[54ch] text-pretty text-lg leading-relaxed text-muted-foreground">
            Browse public content, or join to access webinars, surveys, and personalized learning experiences.
          </p>
          <div className="mt-9 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <Button to="/catalog" size="lg" className="w-full sm:w-auto">
              Browse Catalogue
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button to="/join" variant="outline" size="lg" className="w-full sm:w-auto">
              Get started
            </Button>
          </div>
        </Reveal>
      </Band>
    </div>
  );
}
