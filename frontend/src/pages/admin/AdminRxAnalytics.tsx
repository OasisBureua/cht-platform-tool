export default function AdminRxAnalytics() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">RX Analytics Dashboard</h1>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Campaign:</label>
        <select className="rounded-xl border border-blue-200 bg-blue-50/30 px-4 py-3 text-sm text-gray-700 w-full max-w-md">
          <option>Name of Webinar - Time Frame - Brand</option>
        </select>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Campaign Performance Indicators</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'RX Lift', color: 'blue' },
            { label: 'Engaged HCP', color: 'purple' },
            { label: 'Completion', color: 'orange' },
            { label: 'Impressions', color: 'green' },
          ].map(({ label, color }) => (
            <div key={label} className={`rounded-2xl border-2 p-6 ${
              color === 'blue' ? 'border-blue-200 bg-blue-50/50' :
              color === 'purple' ? 'border-purple-200 bg-purple-50/50' :
              color === 'orange' ? 'border-amber-200 bg-amber-50/50' :
              'border-green-200 bg-green-50/50'
            }`}>
              <p className={`text-2xl font-bold ${
                color === 'blue' ? 'text-blue-600' :
                color === 'purple' ? 'text-purple-600' :
                color === 'orange' ? 'text-amber-600' :
                'text-green-600'
              }`}>X</p>
              <p className="mt-2 text-sm font-semibold text-gray-700">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Key Opinion Leader</h2>
          <p className="text-sm text-gray-600">Current level of engagement</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['green', 'yellow', 'red'].map((accent, i) => (
            <div key={i} className={`rounded-2xl border-2 p-6 ${
              accent === 'green' ? 'border-green-200 bg-green-50/30' :
              accent === 'yellow' ? 'border-amber-200 bg-amber-50/30' :
              'border-red-200 bg-red-50/30'
            }`}>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-gray-200 shrink-0" />
                <div>
                  <p className="font-bold text-gray-900">HCP NAME</p>
                  <p className="text-sm text-gray-600">Name of Practice</p>
                  <p className={`text-sm font-semibold mt-1 ${
                    accent === 'green' ? 'text-green-700' :
                    accent === 'yellow' ? 'text-amber-700' :
                    'text-red-700'
                  }`}>Sentiment Level</p>
                </div>
              </div>
              <p className={`text-2xl font-bold mt-4 ${
                accent === 'green' ? 'text-green-600' :
                accent === 'yellow' ? 'text-amber-600' :
                'text-red-600'
              }`}>#</p>
              <button className={`mt-4 rounded-lg border-2 px-4 py-2 text-sm font-semibold ${
                accent === 'green' ? 'border-green-300 text-green-700 hover:bg-green-100' :
                accent === 'yellow' ? 'border-amber-300 text-amber-700 hover:bg-amber-100' :
                'border-red-300 text-red-700 hover:bg-red-100'
              }`}>
                Engagement Readiness
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Campaign Performance</h2>
          <p className="text-sm text-gray-600">Current level of engagement</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <span className="text-2xl">🧩</span>
            <span className="font-semibold">Key Insight</span>
          </div>
          <p className="text-sm text-gray-600">Lorem ipsum dolor sit amet consectetur. Pulvinar est massa cras tincidunt massa aliquet ultrices.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['green', 'blue', 'purple'].map((color, i) => (
            <div key={i} className={`rounded-2xl p-6 ${
              color === 'green' ? 'bg-green-50/50 border border-green-200' :
              color === 'blue' ? 'bg-blue-50/50 border border-blue-200' :
              'bg-purple-50/50 border border-purple-200'
            }`}>
              <p className={`text-2xl font-bold ${
                color === 'green' ? 'text-green-600' :
                color === 'blue' ? 'text-blue-600' :
                'text-purple-600'
              }`}>X</p>
              <p className="mt-2 text-sm font-semibold text-gray-700">Campaign Analytics</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detailed Analytics</h2>
            <p className="text-sm text-gray-600">Charts, Trends and More analytical breakdowns</p>
          </div>
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">Show More ↓</button>
        </div>
      </section>
    </div>
  );
}
