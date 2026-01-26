import { Link } from 'react-router-dom';
import { ArrowRight, Play, Search, LayoutGrid, Users, Shield } from 'lucide-react';

export default function WhatWeDo() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-600">What We Do</p>
                <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight">
                  We organize clinical education into focused, easy-to-navigate experiences
                </h1>
                <p className="text-sm md:text-base text-gray-600 max-w-2xl">
                  CHT helps clinicians discover treatment-specific content, learn quickly through short-form videos,
                  and explore curated collections built around disease areas and subtypes.
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
                  <p className="text-sm font-semibold text-gray-900">
                    Built to support modern clinical workflows
                  </p>
                  <p className="text-sm text-gray-600">
                    Browse disease hubs, watch curated videos, and share relevant content with your team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
          <div className="space-y-2">
            <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
              Our platform focuses on four things
            </h2>
            <p className="text-sm md:text-base text-gray-600 max-w-2xl">
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
              body="Focused videos designed for busy clinicians—clear takeaways and practical framing."
              cta={{ label: 'Watch a Demo', to: '/watch/bc-101' }}
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
              cta={{ label: 'Explore Collections', to: '/catalog/breast-cancer' }}
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
              A clear path from discovery to learning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Step step="01" title="Discover" body="Browse the catalogue or search for a condition, topic, or speaker." />
            <Step step="02" title="Select" body="Open a disease hub and choose the collection or playlist that matches your need." />
            <Step step="03" title="Watch" body="Watch short-form videos and share with your team for fast alignment." />
          </div>
        </div>
      </section>

      {/* Trust / compliance placeholder */}
      <section className="border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-gray-900">
                <Shield className="h-5 w-5" />
                <p className="text-sm font-semibold">Built with clarity in mind</p>
              </div>
              <h3 className="text-2xl md:text-3xl font-semibold text-gray-900">
                Structured content experiences, ready to scale
              </h3>
              <p className="text-sm md:text-base text-gray-600">
                This page is a demo-friendly placeholder. Swap in approved copy, compliance language, and
                production links when ready.
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
              <p className="text-xs text-gray-500 text-center">
                Demo copy only — replace before production.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =======================
   UI helpers
   ======================= */

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
      <p className="text-sm text-gray-600">{body}</p>
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
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}
