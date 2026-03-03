import { dolNetwork } from '../../data/dol-network';

export default function DolNetwork() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12 md:py-16">
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
              Digital Opinion Leader (DOL) Network
            </h1>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Oncology & Breast Cancer Specialists — Organized by Region
            </p>
          </div>
        </div>
      </section>

      {/* Regions */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-16">
          {dolNetwork.map((region) => (
            <div key={region.id} className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 flex items-center gap-2">
                  <span>{region.emoji}</span>
                  {region.title}
                </h2>
                {region.subtitle && (
                  <p className="mt-1 text-base text-gray-600">{region.subtitle}</p>
                )}
              </div>
              <div className="space-y-8">
                {region.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {entry.name}
                        {entry.isNew && (
                          <span className="ml-2 text-xs font-medium text-gray-500">★ NEW</span>
                        )}
                      </h3>
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      <span className="text-gray-500">Role:</span> {entry.role}
                    </p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      <span className="text-gray-500">Bio:</span> {entry.bio}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="text-gray-500">Education:</span> {entry.education}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="border-t border-gray-200 py-6">
        <p className="text-center text-xs text-gray-500">
          Community Health Technologies — Confidential KOL Network Document | ★ = Newly Added
        </p>
      </div>
    </div>
  );
}
