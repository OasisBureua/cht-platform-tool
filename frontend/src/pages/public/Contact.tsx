import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Phone } from 'lucide-react';

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16 space-y-10">
        {/* Header */}
        <header className="max-w-3xl space-y-3">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
            Let’s connect
          </h1>
          <p className="text-sm md:text-base text-gray-600 leading-relaxed">
            Questions, partnership inquiries, or product feedback — send a note and we’ll follow up.
          </p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form */}
          <div className="lg:col-span-7">
            <div className="rounded-3xl border border-gray-200 bg-white p-7 md:p-8">
              {sent ? (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-900">Message sent</p>
                  <p className="text-sm text-gray-600">
                    Thanks — we’ll follow up shortly. For now, you can continue browsing the catalogue.
                  </p>
                  <div className="pt-4">
                    <Link
                      to="/catalog"
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black"
                    >
                      Browse Catalogue <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <form
                  className="space-y-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    // demo-only: no backend yet
                    setSent(true);
                  }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="First name" placeholder="Jane" />
                    <Field label="Last name" placeholder="Doe" />
                  </div>

                  <Field label="Email" placeholder="you@company.com" type="email" />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Organization (optional)" placeholder="Hospital / Clinic / Company" />
                    <Field label="Role (optional)" placeholder="Physician / Admin / Partner" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-900">
                      Message
                    </label>
                    <textarea
                      rows={5}
                      placeholder="Tell us what you’re looking for..."
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      required
                    />
                  </div>

                  <div className="pt-1 flex flex-col sm:flex-row gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black"
                    >
                      Send message
                    </button>
                    <Link
                      to="/about"
                      className="inline-flex items-center justify-center rounded-full bg-white px-7 py-3 text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 text-center"
                    >
                      Learn more
                    </Link>
                  </div>

                  <p className="text-xs text-gray-500">
                    Demo environment — form does not submit to a backend yet.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* Right info */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-7 md:p-8 space-y-4">
              <p className="text-sm font-semibold text-gray-900">Direct</p>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full border border-gray-200 bg-white flex items-center justify-center">
                  <Mail className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Email</p>
                  <p className="text-sm text-gray-600">info@communityhealth.media</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full border border-gray-200 bg-white flex items-center justify-center">
                  <Phone className="h-5 w-5 text-gray-900" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Phone</p>
                  <p className="text-sm text-gray-600">+1 (000) 000-0000 (placeholder)</p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/catalog"
                  className="text-sm font-semibold text-gray-900 hover:text-gray-700 inline-flex items-center gap-2"
                >
                  Explore catalogue <span>→</span>
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-7 md:p-8 space-y-3">
              <p className="text-sm font-semibold text-gray-900">What to include</p>
              <ul className="text-sm text-gray-600 space-y-2 list-disc pl-5">
                <li>What page or feature you’re referencing</li>
                <li>Your goal (demo, pilot, production)</li>
                <li>Any compliance or review constraints</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  type = 'text',
}: {
  label: string;
  placeholder: string;
  type?: string;
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
