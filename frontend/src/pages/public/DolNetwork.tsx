import { useMemo, useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BadgeCheck, GraduationCap, MapPin, Sparkles } from 'lucide-react';
import { useKolDirectory, type DolEntry, type DolRegion } from '../../hooks/useKolDirectory';
import { hasAiSummary, resolveKolDisplayBrief } from '../../utils/kol-directory-merge';
import { kolCatalogBrowseHref } from '../../utils/kol-catalog-link';

type FlatKol = DolEntry & {
  stateId: string;
  stateTitle: string;
};

function flattenNetwork(regions: DolRegion[]): FlatKol[] {
  return regions.flatMap((r) =>
    r.entries.map((e) => ({
      ...e,
      stateId: r.id,
      stateTitle: r.title,
    })),
  );
}

function avatarSrc(k: FlatKol): string {
  if (k.photoUrl) return k.photoUrl;
  return avatarUrl(k.name);
}

type SortMode = 'state' | 'name-asc' | 'name-desc' | 'new-first';

function institutionHint(k: FlatKol): string {
  const inst = k.institution?.trim();
  if (inst && inst !== '-') {
    return inst.length > 48 ? `${inst.slice(0, 47)}…` : inst;
  }
  const edu = k.education || '';
  const cut = edu.split(/[;(]/)[0]?.trim() || '';
  return cut.length > 48 ? `${cut.slice(0, 47)}…` : cut || '-';
}

function avatarUrl(name: string): string {
  const q = name.replace(/^Dr\.\s*/i, '').trim() || name;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(q)}&size=256&background=c2410c&color=fff&bold=true`;
}

export default function DolNetwork({ embedded = false }: { embedded?: boolean }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stateId, setStateId] = useState('');
  const [institution, setInstitution] = useState('');
  const [newOnly, setNewOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('state');
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const directory = useKolDirectory({
    q: debouncedSearch || undefined,
    institution: institution || undefined,
    new_only: newOnly || undefined,
    surface: embedded ? 'app' : 'public',
  });
  const flat = useMemo(() => flattenNetwork(directory.regions), [directory.regions]);

  const institutions = directory.institutions;

  const filtered = useMemo(() => {
    return flat.filter((k) => {
      if (stateId && k.stateId !== stateId) return false;
      return true;
    });
  }, [flat, stateId]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    const last = (n: string) => n.replace(/^Dr\.\s*/i, '').split(/\s+/).pop() || n;
    if (sortMode === 'name-asc') {
      out.sort((a, b) => last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'name-desc') {
      out.sort((a, b) => last(b.name).localeCompare(last(a.name), undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'new-first') {
      out.sort((a, b) => {
        const aNew = Boolean(a.isNew);
        const bNew = Boolean(b.isNew);
        if (aNew !== bNew) return aNew ? -1 : 1;
        return last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' });
      });
    } else {
      // Default 'state' mode: within each state, featured KOLs pin to the
      // top, then curator display_order (nulls last), then name (SCRUM-70).
      out.sort((a, b) => {
        const st = a.stateTitle.localeCompare(b.stateTitle, undefined, { sensitivity: 'base' });
        if (st !== 0) return st;
        const aFeat = a.featured ? 1 : 0;
        const bFeat = b.featured ? 1 : 0;
        if (aFeat !== bFeat) return bFeat - aFeat;
        const aOrd = a.displayOrder ?? Number.POSITIVE_INFINITY;
        const bOrd = b.displayOrder ?? Number.POSITIVE_INFINITY;
        if (aOrd !== bOrd) return aOrd - bOrd;
        return last(a.name).localeCompare(last(b.name), undefined, { sensitivity: 'base' });
      });
    }
    return out;
  }, [filtered, sortMode]);

  const byState = useMemo(() => {
    if (sortMode !== 'state') return null;
    const map = new Map<string, FlatKol[]>();
    sorted.forEach((k) => {
      if (!map.has(k.stateId)) map.set(k.stateId, []);
      map.get(k.stateId)!.push(k);
    });
    const order = directory.regions.map((r) => r.id).filter((id) => map.has(id));
    return order.map((id) => ({
      id,
      meta: map.get(id)![0],
      items: map.get(id)!,
    }));
  }, [sorted, sortMode, directory.regions]);

  const sortLabels: Record<SortMode, string> = {
    state: 'State, then name (A–Z)',
    'name-asc': 'Name (A–Z)',
    'name-desc': 'Name (Z–A)',
    'new-first': 'New listings first',
  };

  return (
    <div className={embedded ? 'min-w-0' : 'bg-[#f5f5f7] min-h-screen'}>
      <div
        className={
          embedded
            ? 'mx-auto max-w-6xl py-2 sm:py-4 md:py-6'
            : 'mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 md:py-14'
        }
      >
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">CHT Platform</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Key Opinion Leader (KOL) Network</h1>
          <p className="text-sm md:text-base text-muted-foreground max-w-3xl">
            Oncology & breast cancer specialists: filter by state, institution, or text; sort by name, state, or
            newest.
          </p>
        </header>

        <div
          className="rounded-card border border-black/[0.08] bg-card p-4 sm:p-5 shadow-card mb-10 space-y-4"
          role="search"
          aria-label="Filter and sort KOL directory"
        >
          <div className="flex flex-col lg:flex-row lg:flex-nowrap gap-3 lg:items-end lg:gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <label htmlFor="kol-q" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Search
              </label>
              <input
                id="kol-q"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, institution, keywords…"
                className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
                autoComplete="off"
              />
            </div>
            <div className="w-full sm:w-48 lg:w-52 shrink-0 space-y-1">
              <label htmlFor="kol-state" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                State
              </label>
              <select
                id="kol-state"
                value={stateId}
                onChange={(e) => setStateId(e.target.value)}
                className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
              >
                <option value="">All states</option>
                {directory.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-52 lg:w-56 shrink-0 space-y-1">
              <label htmlFor="kol-inst" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Institution
              </label>
              <select
                id="kol-inst"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full rounded-[6px] border border-border px-3 py-2.5 text-sm text-foreground focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
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
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sort</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSortOpen((o) => !o);
                  }}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-[6px] border border-border bg-card hover:bg-brand-50 hover:border-brand-500/35 transition-colors ${
                    sortOpen ? 'bg-brand-50 border-brand-600' : ''
                  }`}
                  aria-expanded={sortOpen}
                  aria-haspopup="listbox"
                  title={sortLabels[sortMode]}
                >
                  <ArrowUpDown className="h-4 w-4 text-foreground" />
                </button>
                {sortOpen && (
                  <ul
                    className="absolute right-0 top-full z-20 mt-2 min-w-[14rem] rounded-[6px] border border-black/[0.08] bg-card py-1 shadow-lg"
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
                          className={`w-full px-3 py-2.5 text-left text-sm hover:bg-brand-50 ${
                            sortMode === mode ? 'font-semibold text-brand-800' : 'text-foreground'
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
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
                className="rounded border-border text-brand-700 focus:ring-brand-600"
              />
              New profiles only
            </label>
            <p className="text-sm text-muted-foreground rounded-full border border-border bg-muted px-3 py-1">
              <span className="font-semibold text-foreground">{sorted.length}</span> shown
            </p>
          </div>
        </div>

        <main id="kol-results" tabIndex={-1}>
          {directory.loadState === 'loading' ? (
            <p className="text-center rounded-card border border-border bg-card py-14 px-6 text-muted-foreground">
              Loading KOL directory…
            </p>
          ) : directory.loadState === 'error' ? (
            <p className="text-center rounded-card border border-red-200 bg-red-50 py-14 px-6 text-destructive">
              Couldn't load the KOL directory. Refresh to try again.
            </p>
          ) : sorted.length === 0 ? (
            <p className="text-center rounded-card border border-border bg-card py-14 px-6 text-muted-foreground">
              No profiles match your filters. Try clearing search or switching state.
            </p>
          ) : sortMode === 'state' && byState ? (
            <div className="space-y-12">
              {byState.map(({ id, meta, items }) => (
                <section key={id} aria-labelledby={`state-${id}`} className="space-y-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
                    <h2 id={`state-${id}`} className="text-xl font-semibold text-foreground">
                      {meta.stateTitle}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {items.length} KOL{items.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
                    {items.map((k) => (
                      <KolCard key={k.id} k={k} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
              {sorted.map((k) => (
                <KolCard key={`${k.stateId}-${k.id}`} k={k} />
              ))}
            </div>
          )}
        </main>

        <footer className="mt-12 space-y-2 border-t border-border pt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Community Health Technologies: KOL Network | ★ = Newly added (within 60 days)
          </p>
          <p className="mx-auto max-w-2xl text-[10px] leading-snug text-muted-foreground">
            AI-generated summaries are provided for convenience and may contain inaccuracies. Verify
            important details against primary sources.
          </p>
        </footer>
      </div>
    </div>
  );
}

function cardSummarySnippet(k: FlatKol): string {
  return resolveKolDisplayBrief(k)?.whoTheyAre ?? k.bio.trim();
}

function KolCard({ k }: { k: FlatKol }) {
  const profileHref = `/kol-network/profile/${k.id}`;
  const contentHref = kolCatalogBrowseHref(k);
  const inst = institutionHint(k);
  const roleLead = (k.role.split(/[.;]/)[0]?.trim() ?? k.role).slice(0, 72);
  const summary = cardSummarySnippet(k);
  const summaryShort = summary.length > 140 ? `${summary.slice(0, 137)}…` : summary;
  const showBadge = Boolean(k.intel?.rosterOnly ?? k.isNew);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-[box-shadow,transform] hover:shadow-md">
      <div className="border-b border-border p-3">
        <div className="flex items-center gap-2.5">
          <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 sm:h-[5.25rem] sm:w-[5.25rem]">
            <img
              src={avatarSrc(k)}
              alt=""
              className="h-full w-full rounded-[15px] border border-border object-cover shadow-inner"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            {k.featured ? (
              <span
                className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-600 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white shadow-card"
                title="Curator-featured KOL"
              >
                ★
              </span>
            ) : null}
            {k.isNew ? (
              <span
                className={
                  k.featured
                    ? 'absolute -left-0.5 -top-0.5 rounded-full bg-orange-600 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white shadow-card'
                    : 'absolute -right-0.5 -top-0.5 rounded-full bg-orange-600 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white shadow-card'
                }
              >
                New
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col justify-center gap-0.5">
              <div className="flex items-center gap-1">
                <h3 className="min-w-0 flex-1 text-[11px] font-bold leading-tight text-foreground line-clamp-2 sm:text-xs">
                  {k.name}
                </h3>
                {showBadge ? (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-brand-600 text-white" aria-label="Listed in CHM network" />
                ) : null}
              </div>
              <p className="text-[10px] leading-snug text-muted-foreground line-clamp-2" title={k.role}>
                {roleLead}
                {roleLead.length >= 72 ? '…' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 pt-2">
        <div className="rounded-card bg-gray-100/90 p-2.5">
          <div className="grid grid-cols-2 gap-2 gap-y-2.5">
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">State</p>
              <p className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold leading-tight text-foreground line-clamp-2">
                <MapPin className="h-2.5 w-2.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0">{k.stateTitle}</span>
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Institution</p>
              <p className="mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold leading-tight text-foreground line-clamp-2">
                <GraduationCap className="h-2.5 w-2.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0" title={inst}>
                  {inst}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-2.5 border-t border-gray-200/80 pt-2.5">
            <div className="flex items-center gap-1">
              <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
              {hasAiSummary(k) ? (
                <span className="inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wide text-warning">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  AI
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground line-clamp-3">{summaryShort}</p>
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-1.5 pt-3 sm:flex-row sm:gap-2">
          <Link
            to={profileHref}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-full bg-brand-600 px-2 text-center text-[10px] font-semibold text-white transition hover:bg-brand-700 sm:text-[11px]"
          >
            Explore profile
          </Link>
          <Link
            to={contentHref}
            className="inline-flex min-h-[36px] flex-1 items-center justify-center rounded-full border border-border bg-card px-2 text-center text-[10px] font-semibold text-foreground transition hover:bg-muted sm:text-[11px]"
          >
            View content
          </Link>
        </div>
      </div>
    </article>
  );
}
