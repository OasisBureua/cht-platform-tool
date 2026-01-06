import { Link, useParams } from 'react-router-dom';
import { PlayCircle, Lock, Award, DollarSign } from 'lucide-react';

/**
 * PublicWatch
 * - Preview-only experience
 * - No progress tracking
 * - Funnels into Join / Login
 */

export default function PublicWatch() {
  const { videoId } = useParams<{ videoId: string }>();

  return (
    <div className="space-y-16">
      {/* =====================
          HEADER
          ===================== */}
      <section className="pt-10">
        <div className="mx-auto max-w-5xl px-6 space-y-4">
          <p className="text-sm font-semibold text-gray-600">Preview</p>

          <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
            Educational Content Preview
          </h1>

          <p className="max-w-2xl text-gray-600">
            Watch a short preview of this educational activity. Create an account
            to unlock full access, earn CME credits, and receive honoraria.
          </p>
        </div>
      </section>

      {/* =====================
          VIDEO PREVIEW
          ===================== */}
      <section>
        <div className="mx-auto max-w-5xl px-6">
          <div className="relative aspect-video rounded-xl border border-gray-200 bg-black overflow-hidden">
            {/* Fake preview poster */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 bg-black/80">
              <PlayCircle className="h-14 w-14 text-white" />
              <p className="text-white font-semibold">
                Preview available
              </p>
              <p className="text-sm text-gray-300 max-w-sm">
                Sign in to watch the full video and receive credit for participation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================
          VALUE PROPOSITION
          ===================== */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ValueCard
            icon={<Award className="h-6 w-6" />}
            title="Earn CME Credits"
            text="Participate in accredited educational activities designed for healthcare professionals."
          />
          <ValueCard
            icon={<DollarSign className="h-6 w-6" />}
            title="Get Paid for Your Time"
            text="Receive honoraria for completing eligible programs and surveys."
          />
          <ValueCard
            icon={<PlayCircle className="h-6 w-6" />}
            title="Flexible Learning"
            text="Access on-demand and live content anytime, anywhere."
          />
        </div>
      </section>

      {/* =====================
          CTA
          ===================== */}
      <section className="bg-gray-900 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center space-y-6">
          <div className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-800 px-4 py-1 text-sm font-semibold text-gray-200">
            <Lock className="h-4 w-4" />
            Full access requires an account
          </div>

          <h2 className="text-3xl font-semibold text-white">
            Unlock full access on CHT
          </h2>

          <p className="text-gray-300 max-w-xl mx-auto">
            Join CHT to watch full educational content, complete surveys,
            earn CME credits, and receive honoraria.
          </p>

          <div className="flex justify-center gap-4">
            <Link
              to="/join"
              className="rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100"
            >
              Create an account
            </Link>

            <Link
              to="/login"
              className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-semibold text-white hover:bg-gray-800"
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

function ValueCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center space-y-3">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-900">
        {icon}
      </div>
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{text}</p>
    </div>
  );
}
