import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';

type ResultType = 'Video' | 'Webinar' | 'Collection';

type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  type: ResultType;
  tag?: string;
  href: string;
};

const MOCK_RESULTS: SearchResult[] = [
  {
    id: 'r1',
    title: 'Breast Cancer 101: Current Landscape',
    subtitle: 'Foundations • 18 min • Dr. Paolo Tarantino',
    type: 'Video',
    tag: 'Breast Cancer',
    href: '/watch/bc-101',
  },
  {
    id: 'r2',
    title: 'HER2+ Treatment Sequencing',
    subtitle: 'HER2+ • 16 min • Dr. Jason Mouabbi',
    type: 'Video',
    tag: 'Breast Cancer',
    href: '/watch/bc-her2-1',
  },
  {
    id: 'r3',
    title: 'Breast Cancer Collection',
    subtitle: 'Curated playlists + webinars',
    type: 'Collection',
    tag: 'Oncology',
    href: '/catalog/breast-cancer',
  },
  {
    id: 'r4',
    title: 'Lung Cancer 101: Biomarkers & Workup',
    subtitle: 'General • 18 min • Biomarkers',
    type: 'Video',
    tag: 'Lung Cancer',
    href: '/watch/lc-101',
  },
  {
    id: 'r5',
    title: 'Upcoming Webinar: Clinical Updates (Demo)',
    subtitle: 'Webinar • 1 CME Credit • Sponsor Name',
    type: 'Webinar',
    tag: 'Webinars',
    href: '/app/webinars', // or a public webinar page later
  },
];

const TYPE_FILTERS: Array<ResultType | 'All'> = ['All', 'Video', 'Webinar', 'Collection'];

export default function Search() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<ResultType | 'All'>('All');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_RESULTS.filter((r) => {
      const matchesQuery = q
        ? r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q)
        : true;
      const matchesType = type === 'All' ? true : r.type === type;
      return matchesQuery && matchesType;
    });
  }, [query, type]);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-8">
        {/* Header */}
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">
            Search
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl">
            Find videos, collections, and educational resources across the content library.
          </p>
        </header>

        {/* Search bar */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by condition, speaker, topic..."
                className="w-full rounded-full border border-gray-200 bg-white pl-11 pr-12 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />

              {query ? (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full hover:bg-gray-50 flex items-center justify-center"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4 text-gray-700" />
                </button>
              ) : null}
            </div>

            <button
              onClick={() => setShowFilters((v) => !v)}
              className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
            </button>
          </div>

          {/* Filters panel */}
          {showFilters ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">Type</p>
                <div className="flex flex-wrap gap-2">
                  {TYPE_FILTERS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={[
                        'rounded-full px-4 py-2 text-sm font-semibold border',
                        type === t
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50',
                      ].join(' ')}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    setType('All');
                    setQuery('');
                  }}
                  className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset
                </button>
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Apply
                </button>
              </div>
            </div>
          ) : null}

          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span>{' '}
            results
          </p>
        </section>

        {/* Results */}
        <section className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="divide-y divide-gray-200">
              {filtered.map((r) => (
                <Link
                  key={r.id}
                  to={r.href}
                  className="block px-5 py-4 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {r.title}
                      </p>
                      <p className="text-sm text-gray-600 truncate">{r.subtitle}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Pill label={r.type} />
                        {r.tag ? <Pill label={r.tag} muted /> : null}
                      </div>
                    </div>

                    <span className="shrink-0 text-gray-400">→</span>
                  </div>
                </Link>
              ))}

              {filtered.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-base font-semibold text-gray-900">
                    No results found
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Try a different search term or reset filters.
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Link
                      to="/catalog"
                      className="rounded-full border border-gray-200 bg-white px-6 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                    >
                      Browse Catalogue
                    </Link>
                    <button
                      onClick={() => {
                        setQuery('');
                        setType('All');
                      }}
                      className="rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Pill({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border',
        muted
          ? 'bg-gray-100 text-gray-700 border-gray-200'
          : 'bg-white text-gray-900 border-gray-200',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
