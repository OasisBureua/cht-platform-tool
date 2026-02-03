import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, X, Clock, User, CheckCircle } from 'lucide-react';

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

const FEATURED_WEBINAR_INFO = {
  title: 'Featured Webinar Title',
  imageUrl: 'https://picsum.photos/seed/webinar-signup/600/320',
  speaker: 'Dr. Sarah Chen',
  time: 'March 15, 2025 at 2:00 PM ET',
  duration: '60 min',
  description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
};

export default function Webinars() {
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [showConfirmedModal, setShowConfirmedModal] = useState(false);

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
        <div
          className="group relative rounded-2xl overflow-hidden min-h-[280px] cursor-pointer"
          onClick={() => setShowSignUpModal(true)}
        >
          <img src={STOCK_IMAGES.featured} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">Featured Webinar Title</h3>
              <span className="mt-2 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">New</span>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Sign Up
            </span>
          </div>
        </div>
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

      {/* Webinar Sign Up Modal */}
      {showSignUpModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowSignUpModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-40">
              <img
                src={FEATURED_WEBINAR_INFO.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => setShowSignUpModal(false)}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{FEATURED_WEBINAR_INFO.title}</h3>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {FEATURED_WEBINAR_INFO.time} · {FEATURED_WEBINAR_INFO.duration}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {FEATURED_WEBINAR_INFO.speaker}
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{FEATURED_WEBINAR_INFO.description}</p>
              <form
                className="space-y-4 pt-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowSignUpModal(false);
                  setShowConfirmedModal(true);
                }}
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
                >
                  Sign Up for Webinar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowConfirmedModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
              <CheckCircle className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">You're signed up!</h3>
            <p className="mt-2 text-sm text-gray-600">
              You've been registered for {FEATURED_WEBINAR_INFO.title}. We'll send a reminder to your email before the webinar.
            </p>
            <button
              onClick={() => setShowConfirmedModal(false)}
              className="mt-6 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
