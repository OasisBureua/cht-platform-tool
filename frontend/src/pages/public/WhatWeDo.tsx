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

const AUDIENCES = [
  {
    title: 'Physicians & healthcare professionals',
    body:
      'CHM provides access to trusted knowledge, expert perspectives, and meaningful peer discussions that support continuous professional development and informed clinical practice.',
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

export default function WhatWeDo() {
  return (
    <div className="bg-white">
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight max-w-2xl">
                  We organize clinical education
                  <br />
                  into focused, easy-to-navigate
                  <br />
                  experiences
                </h1>
                <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
                  Community Health Media delivers expert-led medical communications: content, distribution, and
                  engagement across the healthcare ecosystem. Our public platform helps clinicians discover
                  treatment-specific material, learn through short-form video, and explore curated collections built
                  around disease areas and subtypes.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/catalog"
                  className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black inline-flex items-center justify-center gap-2"
                >
                  Explore Catalogue <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/search"
                  className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 inline-flex items-center justify-center"
                >
                  Search Content
                </Link>
              </div>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniStat label="Collections" value="Curated" />
                <MiniStat label="Videos" value="Short-form" />
                <MiniStat label="Discovery" value="Fast" />
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden">
                <div
                  className="h-[340px] w-full bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1800&q=80')",
                  }}
                >
                  <div className="h-full w-full bg-black/25" />
                </div>
                <div className="p-6 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Built to support modern clinical workflows</p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Browse disease hubs, curated conversations and videos, and share relevant content with your team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Who we serve</h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
              Different audiences need different promises. Here is how CHM shows up for each.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {AUDIENCES.map(({ title, body, icon }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">
                  {icon}
                </div>
                <p className="text-lg font-semibold text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">How we show up</h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
              A concise view of the work behind the scenes, before someone ever hits play.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SHOW_UP.map(({ title, body, icon }) => (
              <div key={title} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">
                  {icon}
                </div>
                <p className="text-lg font-semibold text-gray-900">{title}</p>
                <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
              Our platform focuses on four things
            </h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
              A simple, structured system to make clinical learning easier to discover and faster to consume.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Pillar
              icon={<LayoutGrid className="h-5 w-5" />}
              title="Curated Disease-Area Hubs"
              body="Treatment-specific pages organized by disease area and subtype, with structured collections."
              cta={{ label: 'Browse Catalogue', to: '/catalog' }}
            />
            <Pillar
              icon={<Play className="h-5 w-5" />}
              title="Short-form Video Learning"
              body="Focused videos designed for busy clinicians, with clear takeaways and practical framing."
              cta={{ label: 'Explore conversations', to: '/catalog' }}
            />
            <Pillar
              icon={<Search className="h-5 w-5" />}
              title="Fast Discovery & Search"
              body="Search across topics, conditions, speakers, and collections with quick filters."
              cta={{ label: 'Go to Search', to: '/search' }}
            />
            <Pillar
              icon={<Users className="h-5 w-5" />}
              title="Sharing & Team Learning"
              body="Make it easy to share relevant resources across your clinical team."
              cta={{ label: 'Explore Collections', to: '/catalog' }}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">How it works</h2>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed max-w-2xl">
              A clear path from discovery to learning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Step
              step="01"
              title="Discover"
              body="Browse the catalogue or search for a condition, topic, or speaker."
            />
            <Step
              step="02"
              title="Focus"
              body="Open a disease hub and choose the collection or playlist that matches your clinical question."
            />
            <Step
              step="03"
              title="Learn & share"
              body="Watch short-form video, then share links or playlists with colleagues for faster alignment."
            />
          </div>
        </div>
      </section>

      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-gray-900">
                <Shield className="h-5 w-5" />
                <p className="text-sm font-semibold">Built with clarity in mind</p>
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 max-w-md">
                Structured content experiences,
                <br />
                ready to scale
              </h3>
              <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                Read{' '}
                <Link to="/about" className="font-semibold text-gray-900 underline decoration-gray-300 hover:decoration-gray-900">
                  About
                </Link>{' '}
                for the full CHM story, formats, and what we stand for. For programs, partnerships, or platform
                questions, contact us.
              </p>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-3">
              <Link
                to="/join"
                className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black inline-flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 inline-flex items-center justify-center"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function Pillar({
  icon,
  title,
  body,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: { label: string; to: string };
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">
        {icon}
      </div>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
      <Link to={cta.to} className="text-sm font-semibold text-gray-900 hover:text-gray-700 inline-flex items-center gap-2">
        {cta.label} <span>→</span>
      </Link>
    </div>
  );
}

function Step({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
      <p className="text-sm font-semibold text-gray-500">{step}</p>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}
