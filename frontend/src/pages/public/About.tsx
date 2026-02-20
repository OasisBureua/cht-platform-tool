import { Link } from 'react-router-dom';
import { ArrowRight, Shield, BookOpen, Users } from 'lucide-react';

export default function About() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
              Built to make clinical education easier to discover
            </h1>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              CHT is a healthcare content platform designed to organize expert-led education into
              focused, easy-to-navigate experiences for healthcare professionals.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">Our mission</p>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
                High-signal content for modern clinical practice
              </h2>
            </div>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Healthcare professionals are overwhelmed with information. CHT exists to reduce noise
              by curating expert-led videos, webinars, and surveys into structured collections
              organized by disease area and clinical relevance.
            </p>

            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Our goal is simple: help clinicians learn faster, stay aligned, and access meaningful
              insights that support patient-centered decision making.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Value
                icon={<BookOpen className="h-5 w-5" />}
                title="Curated education"
                body="Focused topics selected for relevance and clarity, not volume."
              />
              <Value
                icon={<Users className="h-5 w-5" />}
                title="Expert perspectives"
                body="Content shaped by real-world clinical experience."
              />
              <Value
                icon={<Shield className="h-5 w-5" />}
                title="Designed for trust"
                body="Structured, transparent presentation built for professional use."
              />
              <Value
                icon={<ArrowRight className="h-5 w-5" />}
                title="Built to scale"
                body="Expandable across disease areas, formats, and learning needs."
              />
            </div>
          </div>

          {/* Right CTA panel */}
          <div className="lg:col-span-5">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-8 space-y-5">
              <p className="text-sm font-semibold text-gray-900">Explore the platform</p>
              <p className="text-sm text-gray-600">
                Browse public content, or join to access webinars, surveys, and personalized learning
                experiences.
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
                  Join CHT
                </Link>
              </div>

              <p className="text-xs text-gray-500">
                Demo environment. Content, features, and language may change prior to production.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =======================
   UI helper
   ======================= */

function Value({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-2">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">
        {icon}
      </div>
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600 leading-relaxed">{body}</p>
    </div>
  );
}
