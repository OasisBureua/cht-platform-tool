export default function Privacy() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
          Privacy Policy
        </h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          This is a placeholder privacy policy page. Replace with your formal policy text before launch.
        </p>
      </header>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 space-y-4">
        <Section
          title="Information we collect"
          body="Basic account details (when you join), usage analytics, and activity participation data (webinars/surveys)."
        />
        <Section
          title="How we use information"
          body="To operate the platform, improve content relevance, and provide access to webinars, surveys, and tracking features."
        />
        <Section
          title="Sharing"
          body="We do not sell personal information. Any sharing is limited to platform operation and approved partnerships."
        />
        <Section
          title="Contact"
          body="For privacy questions, contact support via the Contact Us page."
        />
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
