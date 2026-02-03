import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Monitor, ClipboardList, Video } from 'lucide-react';

const STOCK_IMAGES = [
  'https://picsum.photos/seed/cat1/400/260',
  'https://picsum.photos/seed/cat2/400/260',
  'https://picsum.photos/seed/cat3/400/260',
  'https://picsum.photos/seed/cat4/400/260',
  'https://picsum.photos/seed/cat5/400/260',
  'https://picsum.photos/seed/cat6/400/260',
  'https://picsum.photos/seed/cat7/400/260',
  'https://picsum.photos/seed/cat8/400/260',
  'https://picsum.photos/seed/cat9/400/260',
];

const CATALOG_ITEMS = [
  { id: '1', title: 'HER2+ Big Picture & Practice Change', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
  { id: '2', title: 'First-Line & Sequencing Decisions', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
  { id: '3', title: 'High-Risk & CNS Disease', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
  { id: '4', title: 'HER2+ & Endocrine Crosstalk', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
  { id: '5', title: 'ADC-Centered Conversations', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
  { id: '6', title: 'Expert Roundtables & Deep Dives', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'] },
];

export default function Catalog() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG_ITEMS;
    return CATALOG_ITEMS.filter((c) => c.title.toLowerCase().includes(q));
  }, [query]);

  const tabs = [
    { key: 'webinars', label: 'Webinars', icon: Monitor, to: '/webinars' },
    { key: 'surveys', label: 'Surveys', icon: ClipboardList, to: '/surveys' },
    { key: 'videos', label: 'Videos', icon: Video, to: '/watch' },
  ];

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Explore our Catalogue</h1>

        {/* Search + Filters */}
        <section className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
          <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900">
            <option>All Specialties</option>
          </select>
          <button className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 inline-flex items-center gap-2">
            <span className="w-5 h-0.5 bg-current block" />
            <span className="w-5 h-0.5 bg-current block" />
            <span className="w-5 h-0.5 bg-current block" />
            Sort by
          </button>
        </section>

        {/* Content type tabs */}
        <section className="flex flex-wrap gap-4">
          {tabs.map(({ key, label, icon: Icon, to }) => (
            <Link
              key={key}
              to={to}
              className="flex flex-col items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </section>

        {/* Catalog grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-52">
                <img src={STOCK_IMAGES[idx % STOCK_IMAGES.length]} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
              </div>
              <div className="p-5 space-y-4">
                <h3 className="font-bold text-gray-900">{item.title}</h3>
                <ul className="space-y-1">
                  {item.videoNames.map((v, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      {v}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <Link
                    to="/watch"
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                  >
                    Play all
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
