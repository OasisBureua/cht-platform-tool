import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Zap, Presentation, PlayCircle, ClipboardList } from 'lucide-react';

const STOCK_IMAGES = [
  'https://picsum.photos/seed/exp1/400/260',
  'https://picsum.photos/seed/exp2/400/260',
  'https://picsum.photos/seed/exp3/400/260',
  'https://picsum.photos/seed/exp4/400/260',
  'https://picsum.photos/seed/exp5/400/260',
  'https://picsum.photos/seed/exp6/400/260',
  'https://picsum.photos/seed/exp7/400/260',
  'https://picsum.photos/seed/exp8/400/260',
  'https://picsum.photos/seed/exp9/400/260',
];

const OPPORTUNITIES = [
  { id: '1', title: 'HER2+ Big Picture & Practice Change', type: 'video' as const, videoNames: ['Video Name', 'Video Name', 'Video Name'] },
  { id: '2', title: 'First-Line & Sequencing Decisions', type: 'video' as const, videoNames: ['Video Name', 'Video Name', 'Video Name'] },
  { id: '3', title: 'High-Risk & CNS Disease', type: 'video' as const, videoNames: ['Video Name', 'Video Name', 'Video Name'] },
  { id: '4', title: 'HER2+ & Endocrine Crosstalk', type: 'video' as const, videoNames: ['Video Name', 'Video Name'] },
  { id: '5', title: 'ADC-Centered Conversations', type: 'video' as const, desc: 'Video Description: Lorem ipsum dolor sit amet consectetur.' },
  { id: '6', title: 'Expert Roundtables & Deep Dives', type: 'survey' as const, desc: 'Survey Description: Lorem ipsum dolor sit amet consectetur.' },
];

type Tab = 'best' | 'webinars' | 'videos' | 'surveys';

export default function ExploreOpportunities() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('best');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return OPPORTUNITIES;
    return OPPORTUNITIES.filter((o) => o.title.toLowerCase().includes(q));
  }, [query]);

  const tabs = [
    { key: 'best' as Tab, label: 'Best Match', icon: Zap },
    { key: 'webinars' as Tab, label: 'Webinars', icon: Presentation },
    { key: 'videos' as Tab, label: 'Videos', icon: PlayCircle },
    { key: 'surveys' as Tab, label: 'Surveys', icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Explore Opportunities</h1>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
        </div>
        <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900">
          <option>All Specialties</option>
        </select>
        <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900">
          <option>Sort By</option>
        </select>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) =>
          key === 'webinars' ? (
            <Link
              key={key}
              to="/app/webinars"
              className="flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-sm font-medium transition border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          ) : key === 'videos' ? (
            <Link
              key={key}
              to="/app/watch"
              className="flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-sm font-medium transition border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          ) : key === 'surveys' ? (
            <Link
              key={key}
              to="/app/surveys"
              className="flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-sm font-medium transition border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
            >
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          ) : (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-6 py-4 text-sm font-medium transition ${
                tab === key ? 'border-gray-900 bg-gray-100 text-gray-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-6 w-6" />
              {label}
            </button>
          )
        )}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((item, idx) => (
          <div key={item.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="h-44">
              <img src={STOCK_IMAGES[idx % STOCK_IMAGES.length]} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
            </div>
            <div className="p-4 space-y-3">
              <h3 className="font-bold text-gray-900">{item.title}</h3>
              {item.videoNames ? (
                <ul className="space-y-1">
                  {item.videoNames.map((v, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">{item.desc}</p>
              )}
              <Link
                to="/app/webinars"
                className="inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                {item.type === 'survey' ? 'Join' : 'Play all'}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
