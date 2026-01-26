import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ForHCPs() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-600">For HCPs</p>
                <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight">
                  Evidence-based content designed for clinical practice
                </h1>
                <p className="text-sm md:text-base text-gray-600 max-w-xl">
                  Explore curated collections, expert-led videos, and educational resources built to support
                  patient-centered decision-making.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/join"
                  className="rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black inline-flex items-center justify-center gap-2"
                >
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/catalog"
                  className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 inline-flex items-center justify-center"
                >
                  Browse Content Library
                </Link>
              </div>

              {/* Trust bullets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <MiniBullet title="Curated Collections" subtitle="Focused by disease area + subtype" />
                <MiniBullet title="Expert Speakers" subtitle="Practical, real-world clinical insights" />
                <MiniBullet title="Quick to Consume" subtitle="Short videos built for busy clinicians" />
                <MiniBullet title="Always Expanding" subtitle="New topics and updates added regularly" />
              </div>
            </div>

            {/* Right visual block (simple, matches your minimal style) */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-gray-200 bg-gray-50 overflow-hidden">
                <div
                  className="h-[360px] w-full bg-cover bg-center"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=1800&q=80')",
                  }}
                >
                  <div className="h-full w-full bg-black/25" />
                </div>
                <div className="p-6 space-y-2">
                  <p className="text-sm font-semibold text-gray-900">
                    Built for learning, discovery, and practice impact
                  </p>
                  <p className="text-sm text-gray-600">
                    Explore disease-area hubs, watch short expert videos, and share relevant content with your team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
              What you’ll find inside
            </h2>
            <p className="text-sm md:text-base text-gray-600 max-w-2xl">
              A simple experience built to help you get to the information you need faster.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <FeatureCard
              title="Disease-Area Hubs"
              body="Structured pages by disease area and subtype, with curated playlists and collections."
              ctaLabel="Explore Catalogue"
              href="/catalog"
            />
            <FeatureCard
              title="Short-form Video Learning"
              body="Expert-led videos designed for busy schedules—clear takeaways and practical framing."
              ctaLabel="Watch Now"
              href="/watch/bc-101"
            />
            <FeatureCard
              title="Search & Discovery"
              body="Find content by topic, condition, speaker, or collection with quick filters."
              ctaLabel="Search Content"
              href="/search"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">How it works</h2>
            <p className="text-sm md:text-base text-gray-600 max-w-2xl">
              A straightforward flow from discovery to learning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <StepCard
              step="01"
              title="Browse a treatment area"
              body="Start from the catalogue and open a disease hub built around your needs."
            />
            <StepCard
              step="02"
              title="Select a collection"
              body="Choose a subtype or topic collection to see curated videos and resources."
            />
            <StepCard
              step="03"
              title="Watch and share"
              body="Watch short videos and share relevant content with colleagues."
            />
          </div>
        </div>
      </section>

      {/* Compliance + clarity (demo-safe copy) */}
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900">
                Designed with clarity and trust in mind
              </h3>
              <p className="text-sm md:text-base text-gray-600">
                Content is presented in a clean, structured format to support clinical understanding and team communication.
                (Demo copy — replace with approved language for production.)
              </p>

              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CheckItem label="Clear, structured collections" />
                <CheckItem label="Fast discovery via search + filters" />
                <CheckItem label="Easy sharing for team learning" />
                <CheckItem label="Expandable for additional disease areas" />
              </div>
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
              <p className="text-xs text-gray-500 text-center">
                For demo purposes only — replace copy, links, and compliance text before production.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =======================
   UI Helpers
   ======================= */

function MiniBullet({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  ctaLabel,
  href,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{body}</p>
      <Link
        to={href}
        className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700"
      >
        {ctaLabel} <span>→</span>
      </Link>
    </div>
  );
}

function StepCard({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-3">
      <p className="text-sm font-semibold text-gray-500">{step}</p>
      <p className="text-lg font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}

function CheckItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="h-5 w-5 text-gray-900 mt-0.5" />
      <p className="text-sm text-gray-700">{label}</p>
    </div>
  );
}
