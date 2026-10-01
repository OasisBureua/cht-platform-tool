import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Loader2,
  Search,
  Stethoscope,
} from 'lucide-react';
import { useKolDirectory, type DolEntry, type DolRegion } from '../hooks/useKolDirectory';
import { kolCatalogBrowseHref } from '../utils/kol-catalog-link';
import { KOL_NETWORK_APP_BASE, kolProfilePath, kolRegionPath } from '../utils/kol-network-paths';
import { KolPortrait } from '../components/kol/KolPortrait';

type FlatKol = DolEntry & {
  stateId: string;
  stateTitle: string;
};

type Sort = 'state' | 'name' | 'newest';

function flattenNetwork(regions: DolRegion[]): FlatKol[] {
  return regions.flatMap((r) =>
    r.entries.map((e) => ({ ...e, stateId: r.id, stateTitle: r.title })),
  );
}

function lastName(name: string): string {
  return name.replace(/^Dr\.\s*/i, '').split(/\s+/).pop() || name;
}

function roleLead(role: string): string {
  const lead = (role.split(/[.;]/)[0]?.trim() ?? role).slice(0, 72);
  return lead.length >= 72 ? `${lead}…` : lead;
}

function institutionHint(k: FlatKol): string {
  const inst = k.institution?.trim();
  if (inst && inst !== '-') return inst.length > 48 ? `${inst.slice(0, 47)}…` : inst;
  const cut = (k.education || '').split(/[;(]/)[0]?.trim() || '';
  return cut.length > 48 ? `${cut.slice(0, 47)}…` : cut || '—';
}

/** The member directory shows the bio as written; no generated summary. */
function bioOf(k: FlatKol): string {
  const bio = k.bio?.trim();
  return bio || roleLead(k.role);
}

const fieldClass =
  'h-11 w-full rounded-[6px] border border-border bg-card px-3 text-sm text-foreground outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-steel-500/30';

/**
 * Member-shell KOL directory — same data as public `/kols`,
 * styled like LIVE / Surveys (icon title, chips, filter bar, card grid).
 */
export default function KolNetwork() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [state, setState] = useState('all');
  const [institution, setInstitution] = useState('all');
  const [sort, setSort] = useState<Sort>('state');
  const [newOnly, setNewOnly] = useState(false);
  const id = useId();

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const directory = useKolDirectory({
    q: debouncedQ || undefined,
    institution: institution === 'all' ? undefined : institution,
    new_only: newOnly || undefined,
    surface: 'app',
  });

  const flat = useMemo(() => flattenNetwork(directory.regions), [directory.regions]);

  const shown = useMemo(() => {
    const list = flat.filter((k) => state === 'all' || k.stateId === state);
    const by: Record<Sort, (a: FlatKol, b: FlatKol) => number> = {
      name: (a, b) =>
        lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: 'base' }),
      state: (a, b) => {
        const st = a.stateTitle.localeCompare(b.stateTitle, undefined, { sensitivity: 'base' });
        if (st !== 0) return st;
        const feat = Number(!!b.featured) - Number(!!a.featured);
        if (feat !== 0) return feat;
        const ao = a.displayOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.displayOrder ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: 'base' });
      },
      newest: (a, b) =>
        Number(!!b.isNew) - Number(!!a.isNew) ||
        lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: 'base' }),
    };
    return [...list].sort(by[sort]);
  }, [flat, state, sort]);

  const grouped = useMemo(() => {
    if (sort !== 'state') return null;
    const map = new Map<string, FlatKol[]>();
    for (const k of shown) {
      const arr = map.get(k.stateId) ?? [];
      arr.push(k);
      map.set(k.stateId, arr);
    }
    return [...map.entries()];
  }, [shown, sort]);

  const reset = () => {
    setQ('');
    setState('all');
    setInstitution('all');
    setNewOnly(false);
  };
  const filtered = Boolean(q) || state !== 'all' || institution !== 'all' || newOnly;
  const newCount = flat.filter((k) => k.isNew).length;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2.5 text-foreground">
          <Stethoscope className="h-5 w-5 text-anchor" strokeWidth={2} aria-hidden />
          <h1 className="display text-balance text-display-s text-text md:text-display-m">KOL Network</h1>
        </div>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Oncology and breast cancer specialists on the CHM faculty. Filter by state or institution,
          open a profile, or jump to their catalog content.
        </p>
      </header>

      {directory.loadState === 'ready' ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <StatChip label="Profiles" value={directory.total} />
          <StatChip label="States" value={directory.regions.length} />
          <StatChip label="New this quarter" value={newCount} />
        </div>
      ) : null}

      <div
        role="search"
        aria-label="Filter and sort the KOL directory"
        className="rounded-card border border-border/90 bg-card p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_28px_-12px_rgba(0,0,0,0.45)] md:p-5"
      >
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <div>
            <label htmlFor={`${id}-q`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.75}
                aria-hidden
              />
              <input
                id={`${id}-q`}
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, institution or specialty"
                autoComplete="off"
                className={`${fieldClass} ps-10`}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-state`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              State
            </label>
            <select
              id={`${id}-state`}
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={fieldClass}
            >
              <option value="all">All states</option>
              {directory.regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-inst`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Institution
            </label>
            <select
              id={`${id}-inst`}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className={fieldClass}
            >
              <option value="all">All institutions</option>
              {directory.institutions.map((inst) => (
                <option key={inst} value={inst}>
                  {inst.length > 42 ? `${inst.slice(0, 41)}…` : inst}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-sort`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sort
            </label>
            <select
              id={`${id}-sort`}
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className={fieldClass}
            >
              <option value="state">By state</option>
              <option value="name">By name</option>
              <option value="newest">Newest first</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setNewOnly((v) => !v)}
            aria-pressed={newOnly}
            className={[
              'inline-flex min-h-[40px] items-center rounded-[6px] px-3.5 text-sm font-medium transition-colors',
              newOnly
                ? 'bg-anchor text-ground'
                : 'border border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            ].join(' ')}
          >
            New profiles only
          </button>
          {filtered ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-[40px] items-center rounded-[6px] px-3.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Clear filters
            </button>
          ) : null}
          <p role="status" className="ms-auto text-xs font-medium tabular-nums text-muted-foreground">
            {shown.length} shown
          </p>
        </div>
      </div>

      {directory.loadState === 'loading' ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Loading directory" />
        </div>
      ) : directory.loadState === 'error' ? (
        <EmptyCard
          title="Directory did not load"
          body="Nothing came back this time. Reload the page and try again."
          action={{ label: 'Reload', onClick: () => window.location.reload() }}
        />
      ) : shown.length === 0 ? (
        <EmptyCard
          title="No profiles match those filters"
          body="Widen the search or clear filters to see more of the network."
          action={filtered ? { label: 'Clear filters', onClick: reset } : undefined}
        />
      ) : grouped ? (
        <div className="space-y-8">
          {grouped.map(([st, list]) => (
            <section key={st} className="space-y-3" aria-labelledby={`${id}-${st}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2
                  id={`${id}-${st}`}
                  className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {list[0].stateTitle}
                </h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  · {list.length} {list.length === 1 ? 'KOL' : 'KOLs'}
                </span>
                <Link
                  to={kolRegionPath(KOL_NETWORK_APP_BASE, st)}
                  className="ms-auto text-xs font-semibold text-anchor hover:underline"
                >
                  View state
                </Link>
              </div>
              <KolGrid list={list} />
            </section>
          ))}
        </div>
      ) : (
        <KolGrid list={shown} />
      )}
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="inline-flex min-h-[44px] items-center gap-2 rounded-[6px] border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
      <span className="tabular-nums text-sm font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function EmptyCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-card border border-border bg-card p-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.45)]">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[6px] bg-anchor px-5 text-sm font-semibold text-ground hover:brightness-110"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

function KolGrid({ list }: { list: FlatKol[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {list.map((k) => (
        <li key={`${k.stateId}-${k.id}`}>
          <KolCard k={k} />
        </li>
      ))}
    </ul>
  );
}

function KolCard({ k }: { k: FlatKol }) {
  const profileHref = kolProfilePath(KOL_NETWORK_APP_BASE, k.id);
  const catalogHref = kolCatalogBrowseHref(k);
  const inst = institutionHint(k);

  return (
    <div className="card group flex h-full flex-col overflow-hidden p-0">
      {/* The portrait is the card's lead: the whole top links to the profile. */}
      <Link to={profileHref} className="relative block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" tabIndex={-1} aria-hidden>
        <KolPortrait name={k.name} photoUrl={k.photoUrl} className="aspect-[5/4] w-full rounded-b-none" />
        {k.featured || k.isNew ? (
          <span className="eyebrow absolute start-3 top-3 rounded-[5px] bg-white/90 px-2 py-1 text-on-bright">
            {k.featured ? 'Featured' : 'New'}
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <h3 className="display text-body-l leading-snug text-text">
          <Link to={profileHref} className="hover:text-anchor focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {k.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-body-s text-muted2" title={inst}>
          {inst}
        </p>
        <p className="meta mt-1 text-faint">{k.stateTitle}</p>

        <p className="prose-lede mt-3 line-clamp-2 text-body-s text-dim">{bioOf(k)}</p>

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          <Link
            to={profileHref}
            className="press inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-anchor px-3.5 text-xs font-semibold text-ground hover:brightness-110"
          >
            View profile
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <Link
            to={catalogHref}
            className="press inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface px-3.5 text-xs font-semibold text-text ring-1 ring-hairline-strong hover:bg-surface-2"
          >
            View content
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
