import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

const STOCK_IMAGES = {
  featured: 'https://picsum.photos/seed/web-featured/800/450',
  activity: 'https://picsum.photos/seed/web-activity/400/500',
  webinar: [
    'https://picsum.photos/seed/web-w1/400/260',
    'https://picsum.photos/seed/web-w2/400/260',
    'https://picsum.photos/seed/web-w3/400/260',
    'https://picsum.photos/seed/web-w4/400/260',
    'https://picsum.photos/seed/web-w5/400/260',
    'https://picsum.photos/seed/web-w6/400/260',
  ],
};

const WEBINARS = Array.from({ length: 6 }, (_, i) => ({
  id: `w${i + 1}`,
  title: `Webinar #${i + 1}`,
  description: 'Lorem ipsum dolor sit amet consectetur. Pulvinar est massa cras tincidunt massa aliquet ultrices. Amet facilisi risus varius pellentesque nunc. Ac mauris ultrices nam massa morbi sit.',
  imageUrl: STOCK_IMAGES.webinar[i],
  isNew: true,
}));

export default function Webinars() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Webinars</h1>

      {/* Achievements */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Achievements</h2>
        <div className="flex gap-4 mb-4">
          {[1, 2, 3].map((i) => (
            <Trophy key={i} className="h-8 w-8 text-gray-400" />
          ))}
        </div>
        <div>
          <p className="font-bold text-gray-900">Milestones</p>
          <p className="text-sm text-gray-600">Completed 6 Webinar sessions</p>
          <div className="mt-2 h-1 w-full max-w-xs bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full w-2/3 bg-gray-900 rounded-full" />
          </div>
        </div>
      </section>

      {/* Featured Webinar - 2 cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          to="/app/webinars"
          className="group relative rounded-2xl overflow-hidden min-h-[280px]"
        >
          <img src={STOCK_IMAGES.featured} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Featured Webinar Title</h3>
              <span className="mt-2 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">New</span>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Join Now <span>→</span>
            </span>
          </div>
        </Link>
        <Link
          to="/app/webinars"
          className="group relative rounded-2xl overflow-hidden min-h-[280px]"
        >
          <img src={STOCK_IMAGES.activity} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <h3 className="text-xl font-bold text-white">85 Minutes of Webinar Activity</h3>
            <p className="text-sm text-white/90">See More</p>
          </div>
        </Link>
      </section>

      {/* Webinar Catalogue */}
      <section className="space-y-5">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Webinar Catalogue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {WEBINARS.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-44">
                <img src={w.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
                {w.isNew && (
                  <span className="absolute top-3 left-3 rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">New</span>
                )}
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-gray-900">{w.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-3">{w.description}</p>
                <Link
                  to="/app/webinars"
                  className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Learn More
                </Link>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-center">
          <Link
            to="/app/webinars"
            className="inline-flex rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            See More
          </Link>
        </div>
      </section>
    </div>
  );
}
