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
      'We connect expert knowledge, professional communities, and meaningful engagement so medical knowledge reaches the right audiences and supports insight into how medicine learns and evolves.',
  },
  {
    title: 'Professional community',
    body:
      'We bring together physicians, experts, and healthcare stakeholders so knowledge is exchanged, perspectives are shared, and dialogue can thrive.',
  },
  {
    title: 'Engagement that generates insight',
    body:
      'Through expert-driven content, discussion, and live experiences, we capture meaningful engagement, helping organizations understand how medical audiences learn, respond, and stay informed.',
  },
] as const;

export default function About() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
              About Us
            </h1>
            <p className="text-base md:text-lg text-gray-700 leading-relaxed">
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
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">What we stand for</h2>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                CHM produces credible, expert-driven medical content designed to inform healthcare professionals and
                support continuous learning in an evolving clinical landscape.
              </p>
              <ul className="space-y-5">
                {CORE_PILLARS.map(({ title, body }) => (
                  <li key={title}>
                    <p className="text-sm font-semibold text-gray-900">{title}</p>
                    <p className="mt-1 text-sm text-gray-600 leading-relaxed">{body}</p>
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <Link
                  to="/what-we-do"
                  className="font-semibold text-gray-900 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-900"
                >
                  How we serve different audiences and the platform
                </Link>
              </p>
            </div>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              We help healthcare organizations, pharmaceutical companies, and medical brands connect with healthcare
              professionals (HCPs), key opinion leaders (KOLs), and patient communities through clinically credible,
              high-impact communication.
            </p>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Our approach combines medical content production with targeted distribution, ensuring that important
              knowledge reaches the right audience, at the right time, through the right channels.
            </p>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              By integrating content, community, and data-driven insight, we go beyond traditional medical
              communications. We create meaningful engagement, generate actionable insights, and support better
              decision-making across the healthcare ecosystem.
            </p>

            <p className="text-sm md:text-base text-gray-700 font-medium leading-relaxed">
              Community Health Media helps transform medical knowledge into connection, engagement, and measurable
              impact.
            </p>

            <div className="pt-2 space-y-4">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Formats we deliver</h2>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                CHM develops and delivers a wide range of medical education and communication formats, including:
              </p>
              <ul className="space-y-3 text-sm md:text-base text-gray-600 leading-relaxed">
                {FORMATS.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-900" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 space-y-5 lg:sticky lg:top-24">
              <p className="text-sm font-semibold text-gray-900">Explore the platform</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Browse public content, or join to access webinars, surveys, and personalized learning experiences.
              </p>

              <div className="space-y-3">
                <Link
                  to="/catalog"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black"
                >
                  Browse Catalogue <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/join"
                  className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 bg-white px-7 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
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
