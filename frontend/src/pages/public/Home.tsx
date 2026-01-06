import { Link } from 'react-router-dom';
import { Award, PlayCircle, ClipboardCheck, DollarSign } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-24">
      {/* =====================
          HERO
          ===================== */}
      <section className="pt-16 pb-20">
        <div className="mx-auto max-w-5xl text-center space-y-6">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">
            Earn CME credits and honoraria
            <br className="hidden md:block" />
            by engaging with clinical content
          </h1>

          <p className="mx-auto max-w-2xl text-base md:text-lg text-gray-600">
            CHT connects healthcare professionals with accredited educational
            programs, surveys, and webinars — all in one place.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              to="/catalog"
              className="rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Browse Catalog
            </Link>

            <Link
              to="/join"
              className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Join as an HCP
            </Link>
          </div>
        </div>
      </section>

      {/* =====================
          HOW IT WORKS
          ===================== */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-semibold text-gray-900 text-center">
            How it works
          </h2>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-8">
            <Step
              icon={<ClipboardCheck className="h-6 w-6" />}
              title="Register"
              text="Sign up for an accredited program or activity."
            />
            <Step
              icon={<PlayCircle className="h-6 w-6" />}
              title="Participate"
              text="Watch videos or complete learning activities."
            />
            <Step
              icon={<Award className="h-6 w-6" />}
              title="Complete"
              text="Finish required surveys or assessments."
            />
            <Step
              icon={<DollarSign className="h-6 w-6" />}
              title="Earn"
              text="Receive CME credits and honoraria."
            />
          </div>
        </div>
      </section>

      {/* =====================
          FEATURED PREVIEW
          ===================== */}
      <section>
        <div className="mx-auto max-w-6xl px-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-900">
              Featured educational content
            </h2>

            <Link
              to="/catalog"
              className="text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PreviewCard
              title="Cardiometabolic Care Update"
              sponsor="Industry sponsored"
              reward="$75 honorarium"
            />
            <PreviewCard
              title="Oncology Treatment Pathways"
              sponsor="Accredited CME"
              reward="$50 honorarium"
            />
            <PreviewCard
              title="Neurology Case Series"
              sponsor="Live webinar"
              reward="CME credits"
            />
          </div>
        </div>
      </section>

      {/* =====================
          CTA
          ===================== */}
      <section className="bg-gray-900 py-20">
        <div className="mx-auto max-w-4xl text-center space-y-6 px-6">
          <h2 className="text-3xl font-semibold text-white">
            Join CHT today
          </h2>

          <p className="text-gray-300">
            Access accredited education, participate in research, and earn for your time.
          </p>

          <div className="flex justify-center gap-4">
            <Link
              to="/join"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Create an account
            </Link>

            <Link
              to="/catalog"
              className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Explore catalog
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =====================
   Subcomponents
   ===================== */

function Step({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-900">
        {icon}
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}

function PreviewCard({
  title,
  sponsor,
  reward,
}: {
  title: string;
  sponsor: string;
  reward: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-2">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{sponsor}</p>
      <p className="text-sm font-semibold text-gray-900">{reward}</p>
    </div>
  );
}
