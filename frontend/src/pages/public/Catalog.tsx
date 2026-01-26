import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronDown } from 'lucide-react';

type Category = 'All' | 'Oncology' | 'Metabolic' | 'Cardiology' | 'Neurology';

type CatalogItem = {
  id: string;
  title: string;
  category: Category;
  countLabel: string; // e.g. "12 Videos • 3 Webinars"
  imageUrl: string;
  href: string;
};

const MOCK_ITEMS: CatalogItem[] = [
  {
    id: 'breast-cancer',
    title: 'Breast Cancer',
    category: 'Oncology',
    countLabel: '12 Videos • 3 Webinars',
    href: '/catalog/breast-cancer',
    imageUrl:
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'lung-cancer',
    title: 'Lung Cancer',
    category: 'Oncology',
    countLabel: '9 Videos • 2 Webinars',
    href: '/catalog/lung-cancer',
    imageUrl:
      'https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'weight-loss',
    title: 'Weight Loss',
    category: 'Metabolic',
    countLabel: '8 Videos • 1 Webinar',
    href: '/catalog/weight-loss',
    imageUrl:
      'https://images.unsplash.com/photo-1559757175-5700dde67548?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'diabetes',
    title: 'Diabetes',
    category: 'Metabolic',
    countLabel: '10 Videos • 2 Webinars',
    href: '/catalog/diabetes',
    imageUrl:
      'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'cardiology',
    title: 'Cardiology',
    category: 'Cardiology',
    countLabel: '6 Videos • 1 Webinar',
    href: '/catalog/cardiology',
    imageUrl:
      'https://images.unsplash.com/photo-1580281657527-47f249e8f7b7?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'neurology',
    title: 'Neurology',
    category: 'Neurology',
    countLabel: '7 Videos • 2 Webinars',
    href: '/catalog/neurology',
    imageUrl:
      'https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1600&q=80',
  },
];

const CATEGORIES: Category[] = ['All', 'Oncology', 'Metabolic', 'Cardiology', 'Neurology'];

export default function Catalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All');
  const [visibleCount, setVisibleCount] = useState(8);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MOCK_ITEMS.filter((item) => {
      const matchesCategory = category === 'All' ? true : item.category === category;
      const matchesQuery = q ? item.title.toLowerCase().includes(q) : true;
      return matchesCategory && matchesQuery;
    });
  }, [query, category]);

  const visible = filtered.slice(0, visibleCount);
  const canShowMore = filtered.length > visibleCount;

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-10">
        {/* Header */}
        <header className="space-y-3">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">
            Explore our Catalogue
          </h1>
          <p className="text-sm md:text-base text-gray-600 max-w-2xl">
            Discover treatment-specific resources including videos, webinars, and clinical education.
          </p>
        </header>

        {/* Search + filters */}
        <section className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search treatments, topics, conditions..."
                className="w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>

            {/* Category filter (simple demo dropdown) */}
            <div className="relative w-full md:w-[260px]">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full appearance-none rounded-full border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'All' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
            </div>
          </div>

          {/* Results line */}
          <p className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filtered.length}</span>{' '}
            results
          </p>
        </section>

        {/* Grid */}
        <section className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map((item) => (
              <CatalogCard key={item.id} item={item} />
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <p className="text-base font-semibold text-gray-900">No results found</p>
              <p className="mt-1 text-sm text-gray-600">
                Try searching a different term or adjusting filters.
              </p>
            </div>
          ) : null}

          {/* Show more */}
          {canShowMore ? (
            <div className="flex justify-center">
              <button
                onClick={() => setVisibleCount((v) => v + 6)}
                className="rounded-full border border-gray-200 bg-white px-7 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                Show More
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function CatalogCard({ item }: { item: CatalogItem }) {
  return (
    <Link
      to={item.href}
      className="group rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="relative h-[220px]">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

        <div className="relative h-full p-5 flex flex-col justify-between">
          <div className="inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            {item.category}
          </div>

          <div className="space-y-1">
            <p className="text-xl font-semibold text-white">{item.title}</p>
            <p className="text-sm text-white/90">{item.countLabel}</p>
          </div>
        </div>
      </div>

      <div className="p-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Explore</p>
        <span className="text-gray-400 group-hover:text-gray-700 transition-colors">
          →
        </span>
      </div>
    </Link>
  );
}
