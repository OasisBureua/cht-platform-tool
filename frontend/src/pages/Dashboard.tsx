import { Link } from 'react-router-dom';
import { Presentation, ClipboardList, PlayCircle, ArrowRight } from 'lucide-react';

const STOCK_IMAGES = {
  featured: 'https://picsum.photos/seed/dash-featured/800/500',
  activity: 'https://picsum.photos/seed/dash-activity/400/300',
  webinar: [
    'https://picsum.photos/seed/dash-w1/400/280',
    'https://picsum.photos/seed/dash-w2/400/280',
    'https://picsum.photos/seed/dash-w3/400/280',
    'https://picsum.photos/seed/dash-w4/400/280',
    'https://picsum.photos/seed/dash-w5/400/280',
    'https://picsum.photos/seed/dash-w6/400/280',
  ],
  hcp: ['https://picsum.photos/seed/dash-hcp1/200/200', 'https://picsum.photos/seed/dash-hcp2/200/200'],
  recommendedHcp: [
    { img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80', name: 'HCP Name', title: 'HCP Title', desc: 'Webinar Description: Lorem ipsum dolor sit amet consectetur. Eget est nulla lorem at enim lorem arcu lectus adipiscing.' },
    { img: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=400&q=80', name: 'HCP Name', title: 'HCP Title', desc: 'Webinar Description: Lorem ipsum dolor sit amet consectetur. Eget est nulla lorem at enim lorem arcu lectus adipiscing.' },
  ],
};

const QUICK_ACCESS = [
  { title: 'Join Webinars', desc: 'Attend live medical education sessions and earn $500-$1,000 per webinar', icon: Presentation, to: '/app/webinars' },
  { title: 'Complete Surveys', desc: 'Share your insights through voice-based surveys in just 5-10 minutes', icon: ClipboardList, to: '/app/surveys' },
  { title: 'Conversations or Listen Content', desc: 'View educational videos and earn rewards for staying engaged', icon: PlayCircle, to: '/app/catalog' },
];

const FEATURED_WEBINARS = Array.from({ length: 6 }, (_, i) => ({
  id: `w${i + 1}`,
  title: `Webinar #${i + 1}`,
  description: 'Lorem ipsum dolor sit amet consectetur. Pulvinar est massa cras tincidunt massa aliquet ultrices. Amet facilisi risus varius pellentesque nunc. Ac mauris ultrices nam massa morbi sit.',
  imageUrl: STOCK_IMAGES.webinar[i],
  isNew: true,
}));

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Quick Access - dark cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {QUICK_ACCESS.map((item) => (
          <Link
            key={item.title}
            to={item.to}
            className="group relative rounded-2xl overflow-hidden bg-gray-900 p-6 text-white hover:bg-black transition-colors"
          >
            <div className="relative z-10">
              <item.icon className="h-10 w-10 text-white/90 mb-4" />
              <h3 className="text-lg font-bold mb-2">{item.title}</h3>
              <p className="text-sm text-white/80">{item.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* Recommended Activity */}
      <section className="rounded-2xl overflow-hidden bg-white border border-gray-200">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center p-6 md:p-8 lg:p-10">
          <div className="space-y-5 order-2 lg:order-1">
            <h2 className="text-xl font-bold text-gray-900">Recommended Activity</h2>
            <h4 className="text-2xl md:text-3xl font-semibold text-gray-900">Content Title</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
              ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur.
            </p>
            <Link
              to="/app/webinars"
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Sign Up
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:gap-5 order-1 lg:order-2">
            {STOCK_IMAGES.recommendedHcp.map((hcp, i) => (
              <div key={i} className="rounded-2xl overflow-hidden bg-white">
                <div className="relative w-full aspect-[3/4] min-h-0">
                  <img
                    src={hcp.img}
                    alt=""
                    className="h-full w-full object-cover object-top rounded-t-2xl"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-lg font-semibold text-gray-900">{hcp.name}</p>
                  <p className="text-lg font-semibold text-gray-900">{hcp.title}</p>
                  <p className="text-sm text-gray-600 leading-relaxed mt-2">{hcp.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Activities */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Featured Activities</h2>
          <p className="text-sm text-gray-600 mt-1">Lorem ipsum dolor sit amet consectetur.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURED_WEBINARS.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-40">
                <img src={w.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
                {w.isNew && (
                  <span className="absolute top-3 left-3 rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white">New</span>
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
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-8 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            See More <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
