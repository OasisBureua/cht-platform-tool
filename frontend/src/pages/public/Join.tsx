import { Link, useNavigate } from 'react-router-dom';
import { Award, DollarSign, ClipboardCheck } from 'lucide-react';

export default function Join() {
  const navigate = useNavigate();

  return (
    <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12 md:py-16">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* =====================
            LEFT: VALUE
            ===================== */}
        <div className="space-y-6">
          <p className="text-sm font-semibold text-gray-600">Join</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Join CHT
          </h1>

          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            CHT is a platform for healthcare professionals to participate in
            accredited education, surveys, and research opportunities — and
            earn CME credits and honoraria.
          </p>

          <div className="space-y-4">
            <ValueRow
              icon={<Award className="h-5 w-5" />}
              title="Earn CME credits"
              text="Participate in accredited educational programs."
            />
            <ValueRow
              icon={<DollarSign className="h-5 w-5" />}
              title="Get paid for your time"
              text="Receive honoraria for eligible activities."
            />
            <ValueRow
              icon={<ClipboardCheck className="h-5 w-5" />}
              title="Simple participation"
              text="Complete short videos and surveys on your schedule."
            />
          </div>
        </div>

        {/* =====================
            RIGHT: FORM
            ===================== */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Create your account
          </h2>

          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
            For healthcare professionals only.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              navigate('/app/home');
            }}
          >
            <Input label="Full name" placeholder="Jane Doe" />
            <Input label="Email address" type="email" placeholder="jane@email.com" />
            <Input label="Profession" placeholder="Physician, NP, PA, etc." />

            <button
              type="submit"
              className="w-full rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black"
            >
              Create account
            </button>
          </form>

          <p className="mt-4 text-xs text-gray-500">
            By continuing, you agree to our{' '}
            <Link to="/privacy" className="underline hover:text-gray-700">
              Privacy Policy
            </Link>
            .
          </p>

          <div className="mt-6 text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-gray-900 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================
   Components
   ===================== */

function ValueRow({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-900">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function Input({
  label,
  type = 'text',
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-gray-900">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
      />
    </div>
  );
}
