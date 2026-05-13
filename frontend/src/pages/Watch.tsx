import { Link } from 'react-router-dom';
import { Play, Bookmark, Eye } from 'lucide-react';
import { APP_CATALOG_CONVERSATIONS_HUB } from '../components/navigation/appNavItems';

const STOCK_IMAGES = {
  main: 'https://picsum.photos/seed/watch-main/1200/600',
  playlist: [
    'https://picsum.photos/seed/watch-p1/400/240',
    'https://picsum.photos/seed/watch-p2/400/240',
    'https://picsum.photos/seed/watch-p3/400/240',
    'https://picsum.photos/seed/watch-p4/400/240',
    'https://picsum.photos/seed/watch-p5/400/240',
    'https://picsum.photos/seed/watch-p6/400/240',
  ],
};

const PLAYLISTS = [
  { id: '1', title: 'HER2+ Big Picture & Practice Change', videoNames: ['Video Name', 'Video Name', 'Video Name'], desc: 'Video Description: Lorem ipsum dolor sit amet consectetur.' },
  { id: '2', title: 'First-Line & Sequencing Decisions', videoNames: ['Video Name', 'Video Name', 'Video Name'] },
  { id: '3', title: 'High-Risk & CNS Disease', videoNames: ['Video Name', 'Video Name', 'Video Name'] },
  { id: '4', title: 'HER2+ & Endocrine Crosstalk', videoNames: ['Video Name', 'Video Name'] },
  { id: '5', title: 'ADC-Centered Conversations', desc: 'Video Description: Lorem ipsum dolor sit amet consectetur.' },
  { id: '6', title: 'Expert Roundtables & Deep Dives', videoNames: ['Video Name', 'Video Name'] },
];

export default function Watch() {
  return (
    <div className="space-y-8">
      <h1 className="text-balance text-2xl font-bold text-gray-900 md:text-3xl">Main Study Name</h1>

      {/* Main video + Info */}
      <section className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_12px_48px_-16px_rgba(0,0,0,0.45)]">
            <img src={STOCK_IMAGES.main} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
              <button
                type="button"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white active:scale-[0.96]"
              >
                <Play className="h-8 w-8 text-gray-900 ml-1" fill="currentColor" />
              </button>
              <p className="mt-3 text-white font-semibold">Breast Cancer Treatment Protocol Overview</p>
              <p className="text-sm text-white/90">Duration: 45:32</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
            >
              <Play className="h-4 w-4" /> Play
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200/90 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-[background-color,transform,border-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-50 active:scale-[0.96]"
            >
              <Bookmark className="h-4 w-4" /> Save
            </button>
            <span className="flex items-center gap-1.5 text-sm tabular-nums text-gray-600">
              <Eye className="h-4 w-4" /> 1,247 views
            </span>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-2xl border border-gray-100/90 bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)] lg:w-96">
          <h3 className="mb-3 text-balance font-bold text-gray-900">Video Information</h3>
          <p className="mb-4 text-pretty text-sm text-gray-600">
            In this expert discussion, Dr. VK Gadi and Dr. Ruta Rao break down the data from DESTINY-Breast 05 and 11, and what it means for HER2+ treatment.
          </p>
          <dl className="space-y-2 text-sm">
            <div><dt className="font-semibold text-gray-900">Research Focus:</dt><dd className="text-gray-600">Novel immunotherapy combinations and targeted therapy protocols</dd></div>
            <div><dt className="font-semibold text-gray-900">Institution:</dt><dd className="text-gray-600">Memorial Cancer Research Center</dd></div>
            <div><dt className="font-semibold text-gray-900">Publication Date:</dt><dd className="text-gray-600">March 2025</dd></div>
            <div><dt className="font-semibold text-gray-900">Status:</dt><dd className="text-gray-600">Completed</dd></div>
          </dl>
        </div>
      </section>

      {/* Study Playlists */}
      <section className="space-y-4">
        <div>
          <h2 className="text-balance text-xl font-bold text-gray-900">Study Playlists</h2>
          <p className="text-pretty text-sm text-gray-600">Explore detailed discussions broken down into focused topics.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLAYLISTS.map((p, idx) => (
            <div
              key={p.id}
              className="overflow-hidden rounded-2xl border border-gray-100/90 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.07)] transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_14px_36px_-14px_rgba(0,0,0,0.1)] active:scale-[0.995]"
            >
              <div className="h-44">
                <img src={STOCK_IMAGES.playlist[idx]} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
              </div>
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-gray-900">{p.title}</h3>
                {p.videoNames ? (
                  <ul className="space-y-1">
                    {p.videoNames.map((v, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="h-1 w-1 rounded-full bg-gray-400" />
                        {v}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">{p.desc}</p>
                )}
                <Link
                  to={APP_CATALOG_CONVERSATIONS_HUB}
                  className="inline-flex rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-orange-700 active:scale-[0.96]"
                >
                  {p.videoNames ? 'Play all' : 'Play'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
