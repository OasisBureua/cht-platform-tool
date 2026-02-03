import { Link } from 'react-router-dom';
import { Play, Bookmark, Eye } from 'lucide-react';

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
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Main Study Name</h1>

      {/* Main video + Info */}
      <section className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
            <img src={STOCK_IMAGES.main} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
              <button className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                <Play className="h-8 w-8 text-gray-900 ml-1" fill="currentColor" />
              </button>
              <p className="mt-3 text-white font-semibold">Breast Cancer Treatment Protocol Overview</p>
              <p className="text-sm text-white/90">Duration: 45:32</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              <Play className="h-4 w-4" /> Play
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900">
              <Bookmark className="h-4 w-4" /> Save
            </button>
            <span className="flex items-center gap-1.5 text-sm text-gray-600">
              <Eye className="h-4 w-4" /> 1,247 views
            </span>
          </div>
        </div>
        <div className="w-full lg:w-96 shrink-0 bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-3">Video Information</h3>
          <p className="text-sm text-gray-600 mb-4">
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
          <h2 className="text-xl font-bold text-gray-900">Study Playlists</h2>
          <p className="text-sm text-gray-600">Explore detailed discussions broken down into focused topics.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {PLAYLISTS.map((p, idx) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
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
                  to="/app/watch"
                  className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
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
