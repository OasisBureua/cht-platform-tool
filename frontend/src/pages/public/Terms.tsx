export default function Terms() {
  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <header className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-600 max-w-2xl">
            This is a placeholder terms of service page. Replace with your formal terms before launch.
          </p>
        </header>

        <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 space-y-4">
          <Section title="Acceptance of terms" body="By using this platform, you agree to these terms." />
          <Section title="Use of service" body="You agree to use the service in compliance with applicable laws and in good faith." />
          <Section title="Contact" body="For questions about these terms, contact us via the Contact page." />
        </div>
      </div>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      <p className="text-sm text-gray-600">{body}</p>
    </div>
  );
}
