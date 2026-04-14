import { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown } from 'lucide-react';
import { dolNetwork, type DolEntry, type DolRegion } from '../../data/dol-network';

type FlatKol = DolEntry & {
  regionId: string;
  regionTitle: string;
  regionSubtitle?: string;
};

function flattenNetwork(regions: DolRegion[]): FlatKol[] {
  return regions.flatMap((r) =>
    r.entries.map((e) => ({
      ...e,
      regionId: r.id,
      regionTitle: r.title,
      regionSubtitle: r.subtitle,
    })),
  );
}

type SortMode = 'region' | 'name-asc' | 'name-desc' | 'new-first';

function institutionHint(k: FlatKol): string {
  const edu = k.education || '';
  const cut = edu.split(/[;(]/)[0]?.trim() || '';
  return cut.length > 48 ? `${cut.slice(0, 47)}…` : cut || k.regionTitle;
}

function avatarUrl(name: string): string {
  const q = name.replace(/^Dr\.\s*/i, '').trim() || name;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(q)}&size=256&background=0d4f6c&color=fff&bold=true`;
}

function matchesQuery(k: FlatKol, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${k.name} ${k.role} ${k.bio} ${k.education} ${k.regionTitle}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

export default function DolNetwork() {
  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState('');
  const [institution, setInstitution] = useState('');
  const [newOnly, setNewOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('region');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  const flat = useMemo(() => flattenNetwork(dolNetwork), []);

  const institutions = useMemo(() => {
    const set = new Set<string>();
    flat.forEach((k) => {
      const h = institutionHint(k);
      if (h) set.add(h);
    });
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [flat]);

  const filtered = useMemo(() => {
    return flat.filter((k) => {
      if (!matchesQuery(k, search)) return false;
      if (regionId && k.regionId !== regionId) return false;
      if (institution && institutionHint(k) !== institution) return false;
      if (newOnly && !k.isNew) return false;
      return true;
    });
  }, [flat, search, regionId, institution, newOnly]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    const last = (n: string) => n.replace(/^Dr\.\s*/i, '').split(/\s+/).pop() || n;
    if (sortMode === 'name-asc') {
      out.sort((a, b) => last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'name-desc') {
      out.sort((a, b) => last(b.name).localeCompare(last(a.name), undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'new-first') {
      out.sort((a, b) => {
        if (!!a.isNew !== !!b.isNew) return a.isNew ? -1 : 1;
        return last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' });
      });
    } else {
      out.sort((a, b) => {
        const rg = a.regionTitle.localeCompare(b.regionTitle, undefined, { sensitivity: 'base' });
        if (rg !== 0) return rg;
        return last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' });
      });
    }
    return out;
  }, [filtered, sortMode]);

  const byRegion = useMemo(() => {
    if (sortMode !== 'region') return null;
    const map = new Map<string, FlatKol[]>();
    sorted.forEach((k) => {
      if (!map.has(k.regionId)) map.set(k.regionId, []);
      map.get(k.regionId)!.push(k);
    });
    const order = dolNetwork.map((r) => r.id).filter((id) => map.has(id));
    return order.map((id) => ({
      id,
      meta: map.get(id)![0],
      items: map.get(id)!,
    }));
  }, [sorted, sortMode]);

  const sortLabels: Record<SortMode, string> = {
    region: 'Region, then name (A–Z)',
    'name-asc': 'Name (A–Z)',
    'name-desc': 'Name (Z–A)',
    'new-first': 'New listings first',
  };

  return (
    <div className="bg-[#f5f5f7] min-h-screen">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 md:py-14">
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0d4f6c]">CHT Platform</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">Digital Opinion Leader (DOL) Network</h1>
          <p className="text-sm md:text-base text-gray-600 max-w-3xl">
            Oncology & breast cancer specialists — filter by region, institution, or text; sort by name, region, or newest.
          </p>
        </header>

        <div
          className="rounded-2xl border border-black/[0.08] bg-white p-4 sm:p-5 shadow-sm mb-10 space-y-4"
          role="search"
          aria-label="Filter and sort KOL directory"
        >
          <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-3 lg:items-end lg:gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <label htmlFor="kol-q" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Search
              </label>
              <input
                id="kol-q"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, institution, keywords…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0d4f6c] focus:outline-none focus:ring-2 focus:ring-[#0d4f6c]/25"
                autoComplete="off"
              />
            </div>
            <div className="w-full sm:w-48 lg:w-52 shrink-0 space-y-1">
              <label htmlFor="kol-region" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Region
              </label>
              <select
                id="kol-region"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#0d4f6c] focus:outline-none focus:ring-2 focus:ring-[#0d4f6c]/25"
              >
                <option value="">All regions</option>
                {dolNetwork.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-52 lg:w-56 shrink-0 space-y-1">
              <label htmlFor="kol-inst" className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Institution
              </label>
              <select
                id="kol-inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-[#0d4f6c] focus:outline-none focus:ring-2 focus:ring-[#0d4f6c]/25"
              >
                <option value="">All institutions</option>
                {institutions.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst.length > 42 ? `${inst.slice(0, 41)}…` : inst}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0" ref={sortRef}>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Sort</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortOpen((o) => !o);
                  }}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-[#e8f2f6] hover:border-[#0d4f6c]/40 transition-colors ${
                    sortOpen ? 'bg-[#e8f2f6] border-[#0d4f6c]' : ''
                  }`}
                  aria-expanded={sortOpen}
                  aria-haspopup="listbox"
                  title={sortLabels[sortMode]}
                >
                  <ArrowUpDown className="h-4 w-4 text-gray-800" />
                </button>
                {sortOpen && (
                  <ul
                    className="absolute right-0 top-full z-20 mt-2 min-w-[14rem] rounded-lg border border-black/[0.08] bg-white py-1 shadow-lg"
                    role="listbox"
                  >
                    {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                      <li key={mode}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={sortMode === mode}
                          onClick={() => {
                            setSortMode(mode);
                            setSortOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left text-sm hover:bg-[#e8f2f6] ${
                            sortMode === mode ? 'font-semibold text-[#0d4f6c]' : 'text-gray-900'
                          }`}
                        >
                          {sortLabels[mode]}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-800">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
                className="rounded border-gray-300 text-[#0d4f6c] focus:ring-[#0d4f6c]"
              />
              New profiles only
            </label>
            <p className="text-sm text-gray-600 rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
              <span className="font-semibold text-gray-900">{sorted.length}</span> shown
            </p>
          </div>
        </div>

        <main id="kol-results" tabIndex={-1}>
          {sorted.length === 0 ? (
            <p className="text-center rounded-2xl border border-gray-200 bg-white py-14 px-6 text-gray-600">
              No profiles match your filters. Try clearing search or switching region.
            </p>
          ) : sortMode === 'region' && byRegion ? (
            <div className="space-y-12">
              {byRegion.map(({ id, meta, items }) => (
                <section key={id} aria-labelledby={`reg-${id}`} className="space-y-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 pb-3">
                    <h2 id={`reg-${id}`} className="text-xl font-semibold text-gray-900">
                      {meta.regionTitle}
                    </h2>
                    {meta.regionSubtitle && <span className="text-sm text-gray-500">{meta.regionSubtitle}</span>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {items.map((k) => (
                      <KolCard key={k.id} k={k} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sorted.map((k) => (
                <KolCard key={`${k.regionId}-${k.id}`} k={k} />
              ))}
            </div>
          )}
        </main>

        <p className="mt-12 text-center text-xs text-gray-500 border-t border-gray-200 pt-8">
          Community Health Technologies — KOL Network | ★ = Newly added
        </p>
      </div>
    </div>
  );
}

function KolCard({ k }: { k: FlatKol }) {
  const profileHref = `/kol-network/${k.regionId}#${k.id}`;
  const aff = institutionHint(k);
  const tagline = k.role.length > 120 ? `${k.role.slice(0, 117)}…` : k.role;

  return (
    <article className="rounded-2xl border border-black/[0.08] bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] bg-gradient-to-br from-gray-200 to-gray-100 relative overflow-hidden">
        {k.isNew && (
          <span className="absolute top-2 right-2 z-10 rounded-md bg-orange-700/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        )}
        <img
          src={avatarUrl(k.name)}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="p-4 space-y-1">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">{k.name}</h3>
        <p className="text-xs text-gray-500 line-clamp-1" title={aff}>
          {aff}
        </p>
        <p className="text-xs text-gray-700 line-clamp-2">{tagline}</p>
        <div className="pt-3 mt-2 border-t border-gray-100">
          <Link
            to={profileHref}
            className="text-xs font-semibold text-[#0d4f6c] hover:text-[#0a3d54] inline-flex items-center gap-0.5"
          >
            View profile →
          </Link>
        </div>
      </div>
    </article>
  );
}
