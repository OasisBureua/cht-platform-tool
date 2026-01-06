import { Link } from 'react-router-dom';
import { Award, DollarSign, PlayCircle, Lock } from 'lucide-react';

/**
 * Public Catalog
 * - Read-only browse experience
 * - No enroll actions
 * - Funnels users to Join / Login
 */

export default function Catalog() {
  return (
    <div className="space-y-16">
      {/* =====================
          HEADER
          ===================== */}
      <section className="pt-10">
        <div className="mx-auto max-w-6xl px-6 space-y-4">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900">
            Educational Catalog
          </h1>
          <p className="max-w-2xl text-gray-600">
            Browse accredited webinars, educational videos, and research opportunities.
            Sign in to participate and earn rewards.
          </p>
        </div>
      </section>

      {/* =====================
          FILTER BAR (placeholder)
          ===================== */}
      <section>
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-wrap items-center gap-3">
            <FilterPill label="All" active />
            <FilterPill label="Webinars" />
            <FilterPill label="On-demand" />
            <FilterPill label="CME eligible" />
            <FilterPill label="Honorarium available" />
          </div>
        </div>
      </section>

      {/* =====================
          CONTENT GRID
          ===================== */}
      <section>
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <CatalogCard
            title="Cardiometabolic Care Update"
            description="Clinical guidance and patient case discussions."
            sponsor="Industry sponsored"
            credits="1.5 CME"
            reward="$75 honorarium"
            type="Webinar"
          />

          <CatalogCard
            title="Oncology Treatment Pathways"
            description="Evidence-based sequencing in advanced disease."
            sponsor="Accredited CME"
            credits="1.0 CME"
            reward="$50 honorarium"
            type="On-demand"
          />

          <CatalogCard
            title="Neurology Case Series"
            description="Case-driven insights from practicing neurologists."
            sponsor="Live event"
            credits="CME eligible"
            reward="Credits only"
            type="Webinar"
          />

          <CatalogCard
            title="Primary Care Research Survey"
            description="Share insights on clinical decision making."
            sponsor="Market research"
            credits="—"
            reward="$40 honorarium"
            type="Survey"
          />

          <CatalogCard
            title="Rare Disease Educational Module"
            description="Understanding diagnosis and treatment options."
            sponsor="Accredited education"
            credits="1.0 CME"
            reward="CME credits"
            type="On-demand"
          />
        </div>
      </section>

      {/* =====================
          SIGN-IN CTA
          ===================== */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            Ready to participate?
          </h2>
          <p className="text-gray-600">
            Create an account to register for activities and start earning.
          </p>

          <div className="flex justify-center gap-4 pt-2">
            <Link
              to="/join"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Join CHT
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =====================
   Components
   ===================== */

function FilterPill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={[
        'rounded-full px-4 py-1.5 text-sm font-medium border',
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

function CatalogCard({
  title,
  description,
  sponsor,
  credits,
  reward,
  type,
}: {
  title: string;
  description: string;
  sponsor: string;
  credits: string;
  reward: string;
  type: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-2 py-1">
            {type}
          </span>
        </div>

        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600">{description}</p>

        <div className="space-y-1 text-sm text-gray-700">
          <p>{sponsor}</p>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            {credits}
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            {reward}
          </div>
        </div>
      </div>

      <div className="pt-5">
        <button
          disabled
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-500 cursor-not-allowed"
        >
          <Lock className="h-4 w-4" />
          Sign in to register
        </button>
      </div>
    </div>
  );
}
