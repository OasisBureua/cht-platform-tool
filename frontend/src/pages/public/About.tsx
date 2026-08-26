import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

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

export default function About() {
  return (
    <div className="bg-card">
      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-5xl md:text-6xl font-semibold tracking-tight text-foreground leading-tight">
              About Us
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              Community Health Media (CHM) is a full-service medical communications partner specializing in
              expert-led content, strategic distribution, and multichannel campaigns for the healthcare industry.
            </p>
          </div>
        </div>
      </section>

      {/* Story, core message, formats + CTA (single section, original layout) */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">What we stand for</h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                CHM produces credible, expert-driven medical content designed to inform healthcare professionals and
                support continuous learning as clinical practice changes.
              </p>
              <ul className="space-y-5">
                {CORE_PILLARS.map(({ title, body }) => (
                  <li key={title}>
                    <p className="text-base font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-base text-muted-foreground leading-relaxed">{body}</p>
                  </li>
                ))}
              </ul>
              <p className="text-base">
                <Link
                  to="/what-we-do"
                  className="font-semibold text-foreground underline underline-offset-4 decoration-gray-300 hover:decoration-gray-900"
                >
                  How we serve different audiences and the platform
                </Link>
              </p>
            </div>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              We help healthcare organizations, pharmaceutical companies, and medical brands connect with healthcare
              professionals (HCPs), key opinion leaders (KOLs), and patient communities through clinically credible communication.
            </p>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              Our approach combines medical content production with targeted distribution, so important knowledge
              reaches the right clinicians while it still matters to their practice.
            </p>

            <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
              We treat content, community, and data as one system rather than three separate services. That is what
              sets this apart from traditional medical communications: engagement you can measure, and insight you
              can act on.
            </p>

            <p className="text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
              Community Health Media turns medical knowledge into measurable impact.
            </p>

            <div className="pt-2 space-y-4">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Formats we deliver</h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                CHM develops and delivers a wide range of medical education and communication formats, including:
              </p>
              <ul className="space-y-3 text-base md:text-lg text-muted-foreground leading-relaxed">
                {FORMATS.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-card border border-border bg-muted p-8 space-y-5 lg:sticky lg:top-24">
              <p className="text-base font-semibold text-foreground">Explore the platform</p>
              <p className="text-base text-muted-foreground leading-relaxed">
                Browse public content, or join to access webinars, surveys, and personalized learning experiences.
              </p>

              <div className="space-y-3">
                <Link
                  to="/catalog"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-brand-600 px-7 py-3 text-base font-semibold text-white hover:bg-brand-700"
                >
                  Browse Catalogue <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/join"
                  className="inline-flex w-full items-center justify-center rounded-[6px] border border-border bg-card px-7 py-3 text-base font-semibold text-foreground hover:bg-muted"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
