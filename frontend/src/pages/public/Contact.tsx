import { useState } from 'react';
import { Mail, Send } from 'lucide-react';

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
          Contact Us
        </h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Questions, partnerships, or support — reach out and we’ll get back to you.
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-gray-200 bg-white p-6">
          {sent ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <p className="font-semibold text-gray-900">Message sent</p>
              <p className="mt-1 text-sm text-gray-600">
                Thanks — we’ll get back to you shortly.
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                // Placeholder: wire to backend later
                setSent(true);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <input
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    placeholder="Jane"
                  />
                </Field>

                <Field label="Last name">
                  <input
                    required
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    placeholder="Doe"
                  />
                </Field>
              </div>

              <Field label="Email">
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:border-gray-400">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <input
                    required
                    type="email"
                    className="w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    placeholder="you@hospital.org"
                  />
                </div>
              </Field>

              <Field label="Message">
                <textarea
                  required
                  rows={5}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                  placeholder="Tell us how we can help…"
                />
              </Field>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                <Send className="mr-2 h-4 w-4" />
                Send message
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-5 rounded-3xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm font-semibold text-gray-900">Common topics</p>
          <div className="mt-4 space-y-3 text-sm text-gray-700">
            <Item title="Partnerships" desc="Sponsors, speakers, and content collaboration." />
            <Item title="Support" desc="Login, access, webinars, surveys, and watch issues." />
            <Item title="Press" desc="Requests for product info and media inquiries." />
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold text-gray-600">Response times</p>
            <p className="mt-1 text-sm text-gray-700">
              We typically respond within 1–2 business days.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

function Item({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="font-semibold text-gray-900">{title}</p>
      <p className="mt-1 text-sm text-gray-600">{desc}</p>
    </div>
  );
}
