import { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowUpDown, BadgeCheck, ChevronDown, GraduationCap, MapPin, Sparkles } from 'lucide-react';
import { useKolDirectory, type DolEntry, type DolRegion } from '../../hooks/useKolDirectory';
import { hasAiSummary, resolveKolDisplayBrief } from '../../utils/kol-directory-merge';
import { kolCatalogBrowseHref } from '../../utils/kol-catalog-link';
import { Button, Chip, chipKind, Field, Rail, SectionHead } from '../../components/ui';

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

/**
 * The specialty string arrives as one middot-joined line
 * ("Medical Oncology · Breast Cancer (TNBC)"). Split it back into the
 * labels it already carries rather than inventing a taxonomy.
 */
function specialtyLabels(k: FlatKol): string[] {
  const raw = k.intel?.specialty?.trim();
  if (!raw) return [];
  return raw
    .split(/[·|]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** Reveal stagger, capped so a long list never waits seconds to appear. */
function revealDelay(i: number): string {
  return `${Math.min(i, 6) * 60}ms`;
}

const SELECT_CLASS =
  'h-12 w-full appearance-none rounded-[6px] bg-card pl-4 pr-10 text-base text-foreground shadow-card ' +
  'outline-none transition-shadow duration-150 hover:shadow-card-hover sm:text-sm ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const CHEVRON_CLASS =
  'pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground';

const CONTROL_LABEL_CLASS = 'block text-sm text-muted-foreground';

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

  /* The page column. `bleed-x` on the rails is measured against
     `--page-gutter`, so the column has to carry exactly that padding for
     the first card to line up with the copy above it. Embedded, the app
     shell already supplies the gutter, so the column adds none and the
     rails give their bleed back. */
  const column = embedded
    ? 'mx-auto w-full min-w-0 max-w-7xl'
    : 'mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8';
  const railBleed = embedded ? 'mx-0 px-0' : undefined;

  /* Live counts, not claims: everything here is read off the response
     that is already driving the selects below. */
  const facets = [
    { label: 'Profiles', value: directory.total },
    { label: 'States', value: directory.regions.length },
    { label: 'Institutions', value: institutions.length },
  ];

  return (
    <div className={embedded ? 'min-w-0' : 'min-h-screen bg-background'}>
      {/* ── Masthead ─────────────────────────────────────── */}
      <section aria-labelledby="kol-network-heading">
        <div className={`${column} ${embedded ? 'pb-8 pt-4 md:pb-10 md:pt-6' : 'pb-12 pt-14 md:pb-16 md:pt-24'}`}>
          <p className="rise-in font-mono text-label uppercase text-muted-foreground">CHT Platform</p>
          <h1
            id="kol-network-heading"
            className="rise-in mt-5 max-w-[20ch] text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-5xl md:text-[3rem]"
            style={{ animationDelay: revealDelay(1) }}
          >
            Key Opinion Leader (KOL) Network
          </h1>
          <p
            className="rise-in mt-6 max-w-[54ch] text-pretty text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: revealDelay(2) }}
          >
            Oncology & breast cancer specialists: filter by state, institution, or text; sort by name, state, or
            newest.
          </p>

          {directory.loadState === 'ready' && (
            <dl
              className="rise-in mt-10 flex flex-wrap gap-x-12 gap-y-6"
              style={{ animationDelay: revealDelay(3) }}
            >
              {facets.map((f) => (
                <div key={f.label}>
                  <dt className="font-mono text-label uppercase text-muted-foreground">{f.label}</dt>
                  <dd className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {/* ── Controls ─────────────────────────────────────── */}
      <section>
        <div className={`${column} ${embedded ? 'pb-8' : 'pb-12 md:pb-16'}`}>
          <div role="search" aria-label="Filter and sort KOL directory" className="space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <Field
                label="Search"
                id="kol-q"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, institution, keywords…"
                autoComplete="off"
                className="min-w-0 flex-1"
              />

              <div className="w-full shrink-0 sm:w-52 lg:w-56">
                <label htmlFor="kol-state" className={CONTROL_LABEL_CLASS}>
                  State
                </label>
                <div className="relative mt-2">
                  <select
                    id="kol-state"
                    value={stateId}
                    onChange={(e) => setStateId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">All states</option>
                    {directory.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={CHEVRON_CLASS} aria-hidden />
                </div>
              </div>

              <div className="w-full shrink-0 sm:w-56 lg:w-60">
                <label htmlFor="kol-inst" className={CONTROL_LABEL_CLASS}>
                  Institution
                </label>
                <div className="relative mt-2">
                  <select
                    id="kol-inst"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">All institutions</option>
                    {institutions.map((inst) => (
                      <option key={inst} value={inst}>
                        {inst.length > 42 ? `${inst.slice(0, 41)}…` : inst}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={CHEVRON_CLASS} aria-hidden />
                </div>
              </div>

              <div className="shrink-0" ref={sortRef}>
                <span className={CONTROL_LABEL_CLASS}>Sort</span>
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSortOpen((o) => !o);
                    }}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-[6px] text-foreground shadow-card transition-[background-color,box-shadow,scale] duration-150 motion-safe:active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      sortOpen ? 'bg-muted shadow-card-hover' : 'bg-card hover:bg-muted hover:shadow-card-hover'
                    }`}
                    aria-expanded={sortOpen}
                    aria-haspopup="listbox"
                    title={sortLabels[sortMode]}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </button>
                  {sortOpen && (
                    <ul
                      className="absolute right-0 top-full z-20 mt-2 min-w-[15rem] rounded-card bg-card p-1 shadow-card-hover"
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
                            className={`w-full rounded-[6px] px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-muted ${
                              sortMode === mode ? 'font-semibold text-brand-700' : 'text-foreground'
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-[6px] bg-card px-4 text-sm font-medium text-foreground shadow-card transition-shadow duration-150 hover:shadow-card-hover">
                <input
                  type="checkbox"
                  checked={newOnly}
                  onChange={(e) => setNewOnly(e.target.checked)}
                  className="rounded-[3px] border-border text-brand-600 focus:ring-brand-600"
                />
                New profiles only
              </label>
              <p className="inline-flex h-11 items-center rounded-[6px] bg-muted px-4 text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span>
                <span className="ml-1.5">shown</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Directory ────────────────────────────────────── */}
      <section>
        <div className={`${column} ${embedded ? 'pb-10' : 'pb-16 md:pb-24'}`}>
          <main id="kol-results" tabIndex={-1}>
            {directory.loadState === 'loading' ? (
              <p className="rounded-card bg-card px-6 py-16 text-center text-muted-foreground shadow-card">
                Loading KOL directory…
              </p>
            ) : directory.loadState === 'error' ? (
              <p className="rounded-card bg-card px-6 py-16 text-center text-destructive shadow-card">
                Couldn't load the KOL directory. Refresh to try again.
              </p>
            ) : sorted.length === 0 ? (
              <p className="rounded-card bg-card px-6 py-16 text-center text-muted-foreground shadow-card">
                No profiles match your filters. Try clearing search or switching state.
              </p>
            ) : sortMode === 'state' && byState ? (
              /* One rail per state: the last card runs off the edge, which
                 reads as "more that way" instead of a cropped grid. */
              <div className="space-y-14 md:space-y-20">
                {byState.map(({ id, meta, items }, i) => (
                  <section
                    key={id}
                    aria-label={meta.stateTitle}
                    className="rise-in"
                    style={{ animationDelay: revealDelay(i) }}
                  >
                    <SectionHead
                      index={`${String(i + 1).padStart(2, '0')} / ${id}`}
                      title={meta.stateTitle}
                      action={
                        <span className="inline-flex h-9 shrink-0 items-center rounded-[6px] bg-muted px-3.5 text-sm text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground">{items.length}</span>
                          <span className="ml-1.5">KOL{items.length === 1 ? '' : 's'}</span>
                        </span>
                      }
                    />
                    <div className="mt-10">
                      <Rail className={railBleed} aria-label={`${meta.stateTitle} KOLs`}>
                        {items.map((k) => (
                          <li
                            key={k.id}
                            className="w-[74%] shrink-0 snap-start sm:w-[46%] md:w-[31%] lg:w-[23%]"
                          >
                            <KolCard k={k} />
                          </li>
                        ))}
                      </Rail>
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <SectionHead
                  index="01 / Directory"
                  title="All profiles"
                  sub={sortLabels[sortMode]}
                  action={
                    <span className="inline-flex h-9 shrink-0 items-center rounded-[6px] bg-muted px-3.5 text-sm text-muted-foreground">
                      <span className="font-semibold tabular-nums text-foreground">{sorted.length}</span>
                      <span className="ml-1.5">shown</span>
                    </span>
                  }
                />
                <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {sorted.map((k, i) => (
                    <div
                      key={`${k.stateId}-${k.id}`}
                      className="rise-in"
                      style={{ animationDelay: revealDelay(i) }}
                    >
                      <KolCard k={k} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </main>
        </div>
      </section>

      {/* ── Colophon ─────────────────────────────────────── */}
      <section>
        <div className={`${column} ${embedded ? 'pb-6' : 'pb-16 md:pb-24'}`}>
          <footer className="text-center">
            <p className="font-mono text-xs text-muted-foreground">
              Community Health Technologies: KOL Network | ★ = Newly added (within 60 days)
            </p>
            <p className="mx-auto mt-4 max-w-[54ch] text-xs leading-relaxed text-muted-foreground">
              AI-generated summaries are provided for convenience and may contain inaccuracies. Verify
              important details against primary sources.
            </p>
          </footer>
        </div>
      </section>
    </div>
  );
}

function cardSummarySnippet(k: FlatKol): string {
  return resolveKolDisplayBrief(k)?.whoTheyAre ?? k.bio.trim();
}

/**
 * A portrait card: the headshot fills the top of the surface and the
 * name sits on it, so a rail of these reads as a row of people rather
 * than a row of rows. Separation is the surface plus its shadow; the
 * only lines on the card are the ones in the photograph.
 */
function KolCard({ k }: { k: FlatKol }) {
  const profileHref = `/kol-network/profile/${k.id}`;
  const contentHref = kolCatalogBrowseHref(k);
  const inst = institutionHint(k);
  const roleLead = (k.role.split(/[.;]/)[0]?.trim() ?? k.role).slice(0, 72);
  const summary = cardSummarySnippet(k);
  const summaryShort = summary.length > 140 ? `${summary.slice(0, 137)}…` : summary;
  const showBadge = Boolean(k.intel?.rosterOnly ?? k.isNew);
  const specialties = specialtyLabels(k);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card bg-card shadow-card transition-[box-shadow,translate] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-card-hover">
      {/* Under the scrim this is a permanently dark region, so the name
          and role take fixed white rather than the page tokens. */}
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-muted">
        <img
          src={avatarSrc(k)}
          alt=""
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:scale-[1.03]"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"
        />

        {(k.featured || k.isNew) && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {k.featured ? (
              <span
                className="inline-flex h-6 items-center rounded-[6px] bg-brand-600 px-2 text-[11px] font-bold leading-none text-white"
                title="Curator-featured KOL"
              >
                ★
              </span>
            ) : null}
            {k.isNew ? (
              <span className="inline-flex h-6 items-center rounded-[6px] bg-accent px-2 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                New
              </span>
            ) : null}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-start gap-1.5">
            <h3 className="line-clamp-2 min-w-0 flex-1 text-lg font-semibold leading-[1.2] tracking-[-0.018em] text-white">
              {k.name}
            </h3>
            {showBadge ? (
              <BadgeCheck
                className="mt-1 h-4 w-4 shrink-0 fill-brand-600 text-white"
                aria-label="Listed in CHM network"
              />
            ) : null}
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/70" title={k.role}>
            {roleLead}
            {roleLead.length >= 72 ? '…' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {specialties.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {specialties.map((s) => (
              <li key={s}>
                <Chip kind={chipKind(s)}>{s}</Chip>
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-3">
          <div className="min-w-0">
            <dt className="font-mono text-label uppercase text-muted-foreground">State</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate">{k.stateTitle}</span>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-label uppercase text-muted-foreground">Institution</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 truncate" title={inst}>
                {inst}
              </span>
            </dd>
          </div>
        </dl>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-label uppercase text-muted-foreground">Summary</p>
            {hasAiSummary(k) ? (
              <span className="inline-flex items-center gap-1 font-mono text-label uppercase text-warning">
                <Sparkles className="h-3 w-3" aria-hidden />
                AI
              </span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{summaryShort}</p>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          <Button to={profileHref} size="sm" className="w-full">
            Explore profile
          </Button>
          <Button to={contentHref} variant="outline" size="sm" className="w-full">
            View content
          </Button>
        </div>
      </div>
    </article>
  );
}
