import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function About() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
          About CHT
        </h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          CHT is a content platform built to keep healthcare professionals informed through
          webinars, surveys, and a curated educational library.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-xs font-semibold text-gray-600">Our mission</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-700">
            We help clinicians and healthcare leaders access timely, high-signal information. From
            expert-led videos to research-backed discussions, the goal is simple: make it easier to
            learn, contribute, and stay aligned with what matters in patient care.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Feature title="Curated content" desc="Videos and topics selected for signal, not noise." />
            <Feature title="Webinars" desc="Live sessions and on-demand learning." />
            <Feature title="Surveys" desc="Gather perspectives and feedback from HCPs." />
            <Feature title="Rewards-ready" desc="Join to unlock the earning experience." />
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl border border-gray-200 bg-gray-900 p-6">
          <p className="text-sm font-semibold text-white">Get started</p>
          <p className="mt-2 text-sm text-gray-300">
            Browse the library publicly, or join to access webinars, surveys, and earnings tracking.
          </p>

          <div className="mt-5 space-y-3">
            <Link
              to="/catalog"
              className="inline-flex w-full items-center justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Browse catalogue <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              to="/join"
              className="inline-flex w-full items-center justify-center rounded-lg border border-gray-700 bg-transparent px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Join Now →
            </Link>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            Watching is free. Rewards require an account.
          </p>
        </div>
      </section>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  );
}
