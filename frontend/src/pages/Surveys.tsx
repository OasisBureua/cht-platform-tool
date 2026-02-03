import { Link } from 'react-router-dom';

const STOCK_IMAGES = {
  featured: 'https://picsum.photos/seed/surv-featured/800/450',
  activity: 'https://picsum.photos/seed/surv-activity/400/500',
  avatar: 'https://picsum.photos/seed/surv-avatar/200/200',
};

const SURVEYS = [
  { id: '1', name: 'Survey Name', description: 'Survey Description' },
  { id: '2', name: 'Survey Name', description: 'Survey Description' },
  { id: '3', name: 'Survey Name', description: 'Survey Description' },
  { id: '4', name: 'Survey Name', description: 'Survey Description' },
];

export default function Surveys() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Surveys</h1>

      {/* Featured Surveys - 2 cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          to="/app/surveys"
          className="group relative rounded-2xl overflow-hidden min-h-[260px]"
        >
          <img src={STOCK_IMAGES.featured} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Featured Survey Title</h3>
              <span className="mt-2 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">New</span>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Join Now <span>→</span>
            </span>
          </div>
        </Link>
        <Link
          to="/app/surveys"
          className="group relative rounded-2xl overflow-hidden min-h-[260px]"
        >
          <img src={STOCK_IMAGES.activity} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <h3 className="text-xl font-bold text-white">85 Minutes of Survey Activity</h3>
            <p className="text-sm text-white/90">See More</p>
          </div>
        </Link>
      </section>

      {/* Survey Catalogue */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Survey Catalogue</h2>
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-200 overflow-hidden">
          {SURVEYS.map((s) => (
            <div key={s.id} className="flex items-center gap-4 p-4">
              <img src={STOCK_IMAGES.avatar} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" loading="eager" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-600">{s.description}</p>
              </div>
              <Link
                to="/app/surveys"
                className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Join
              </Link>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <Link
            to="/app/surveys"
            className="inline-flex rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-black w-full max-w-md justify-center"
          >
            See More
          </Link>
        </div>
      </section>
    </div>
  );
}
