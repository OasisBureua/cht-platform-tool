import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, Sparkles } from 'lucide-react';
import { useKolDirectory, type DolEntry, type DolRegion } from '../../hooks/useKolDirectory';
import { hasAiSummary, resolveKolDisplayBrief } from '../../utils/kol-directory-merge';
import { kolCatalogBrowseHref } from '../../utils/kol-catalog-link';
import { Button, Reveal } from '../../components/ui';

/* ── data shape ───────────────────────────────────────────
   The API groups by region; the directory reads a flat list
   and re-groups it, so the state a KOL belongs to travels on
   the record itself. */

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

/** Surname, so "By name" sorts the way a directory is read. */
function lastName(name: string): string {
  return name.replace(/^Dr\.\s*/i, '').split(/\s+/).pop() || name;
}

/** The role arrives as prose; the card carries its first clause. */
function roleLead(role: string): string {
  const lead = (role.split(/[.;]/)[0]?.trim() ?? role).slice(0, 72);
  return lead.length >= 72 ? `${lead}…` : lead;
}

function institutionHint(k: FlatKol): string {
  const inst = k.institution?.trim();
  if (inst && inst !== '-') return inst.length > 48 ? `${inst.slice(0, 47)}…` : inst;
  const cut = (k.education || '').split(/[;(]/)[0]?.trim() || '';
  return cut.length > 48 ? `${cut.slice(0, 47)}…` : cut || '-';
}

function summaryOf(k: FlatKol): string {
  const full = resolveKolDisplayBrief(k)?.whoTheyAre ?? k.bio.trim();
  return full.length > 140 ? `${full.slice(0, 137)}…` : full;
}

function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .map((w) => w[0])
    .join('');
}

/* ── page chrome ──────────────────────────────────────────
   Ported from the design's `PageHead` / `HeroPanel`: the
   inner-page masthead splits into copy on the leading side
   and a raised product panel on the trailing side. */

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow text-muted2">{children}</p>;
}

function PageHead({
  eyebrow,
  title,
  lede,
  children,
  figure,
  rail,
  pad,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  children?: ReactNode;
  figure?: ReactNode;
  rail: string;
  pad: string;
}) {
  return (
    <section className={`${rail} ${pad}`}>
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
            {title}
          </h1>
          {lede ? <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">{lede}</p> : null}
          {children ? <div className="mt-9">{children}</div> : null}
        </div>
        {figure ? <div>{figure}</div> : null}
      </div>
    </section>
  );
}

/**
 * Shared frame for the inner-page hero visual: a raised panel on a
 * soft brand-tinted field, with a bevel highlight along the top edge.
 * Depth only, no outlines.
 */
function HeroPanel({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="relative">
      <div
        className="pointer-events-none absolute -inset-8 rounded-[24px] opacity-80 blur-2xl"
        style={{
          background:
            'radial-gradient(50% 50% at 70% 30%, color-mix(in oklab, var(--color-beam) 34%, transparent), transparent 70%), radial-gradient(45% 45% at 25% 75%, color-mix(in oklab, var(--color-pink) 30%, transparent), transparent 70%)',
        }}
      />
      <div className="relative overflow-hidden rounded-[6px] bg-surface p-3 shadow-[var(--shadow-pop)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="overflow-hidden rounded-[6px] bg-ground">{children}</div>
      </div>
    </div>
  );
}

function Chrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 bg-surface px-4 py-3">
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="meta ms-2 text-faint">{label}</span>
    </div>
  );
}

/** The directory as the product: the first four profiles and the live count. */
function KolPanel({ rows, count }: { rows: FlatKol[]; count: number }) {
  return (
    <HeroPanel>
      <Chrome label="chm / kol-network" />
      <div className="p-4">
        <div className="flex gap-2">
          <span className="flex h-9 flex-1 items-center rounded-[6px] bg-surface px-3 text-body-s text-faint">
            Search name or institution
          </span>
          <span className="flex h-9 items-center rounded-[6px] bg-anchor px-3 text-body-s tabular-nums text-ground">
            {count}
          </span>
        </div>
        <ul className="mt-3 space-y-2">
          {rows.map((k) => (
            <li key={`${k.stateId}-${k.id}`} className="flex items-center gap-3 rounded-[6px] bg-surface p-3">
              {k.photoUrl ? (
                <img
                  src={k.photoUrl}
                  alt=""
                  className="size-9 shrink-0 rounded-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[0.625rem] text-muted2">
                  {initials(k.name)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-s font-medium text-text">{k.name}</span>
                <span className="meta mt-0.5 block truncate text-faint">{institutionHint(k)}</span>
              </span>
              <span className="meta shrink-0 rounded-[6px] bg-surface-2 px-2 py-1 text-muted2">
                {k.stateId.slice(0, 2).toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[6px] px-8 py-16 text-center shadow-[var(--shadow-card)]">
      <p className="display text-display-s text-text">{title}</p>
      <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">{body}</p>
      <div className="mt-7 flex justify-center">
        <Button variant="outline" onClick={action.onClick}>
          {action.label}
        </Button>
      </div>
    </div>
  );
}

/**
 * Faceted directory: free-text plus state and institution, with the
 * result count in a live region so filtering announces. Grouping by
 * state is preserved from the platform's own view.
 */
export default function DolNetwork({ embedded = false }: { embedded?: boolean }) {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [state, setState] = useState('all');
  const [institution, setInstitution] = useState('all');
  const [sort, setSort] = useState<Sort>('state');
  const [newOnly, setNewOnly] = useState(false);
  const id = useId();

  // Search hits the API, so it waits for a pause in typing.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const directory = useKolDirectory({
    q: debouncedQ || undefined,
    institution: institution === 'all' ? undefined : institution,
    new_only: newOnly || undefined,
    surface: embedded ? 'app' : 'public',
  });

  const flat = useMemo(() => flattenNetwork(directory.regions), [directory.regions]);

  const shown = useMemo(() => {
    const list = flat.filter((k) => state === 'all' || k.stateId === state);
    const by: Record<Sort, (a: FlatKol, b: FlatKol) => number> = {
      name: (a, b) => lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: 'base' }),
      /* Within a state, curator-featured pins to the top, then the
         curator's display order (nulls last), then surname (SCRUM-70). */
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

  const field =
    'card h-11 w-full rounded-[6px] px-4 text-base text-text outline-none ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-body-s';

  /* Embedded in the app shell, the shell already carries the gutter, so
     the page column adds none and only the max width survives. */
  const rail = embedded ? 'mx-auto w-full min-w-0 max-w-7xl' : 'rail';

  const newCount = flat.filter((k) => k.isNew).length;

  return (
    <div className={embedded ? 'min-w-0' : 'min-h-screen bg-ground'}>
      <PageHead
        rail={rail}
        pad={embedded ? 'pb-8 pt-4 md:pb-10 md:pt-6' : 'pb-12 pt-14 md:pb-16 md:pt-16'}
        eyebrow="KOL network"
        title="The faculty behind every session"
        lede={`Oncology and breast cancer specialists across ${directory.regions.length} states. Filter by state, institution or specialty, and go from a profile straight to what they have recorded.`}
        figure={<KolPanel rows={shown.slice(0, 4)} count={directory.total} />}
      >
        {directory.loadState === 'ready' ? (
          <dl className="flex flex-wrap gap-x-14 gap-y-6">
            {[
              [String(directory.total), 'profiles'],
              [String(directory.regions.length), 'states'],
              [String(newCount), 'added this quarter'],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="sr-only">{l}</dt>
                <dd>
                  <span className="display block text-display-m tabular-nums text-text">{n}</span>
                  <span className="mt-1 block text-body-s text-muted2">{l}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </PageHead>

      <div
        role="search"
        aria-label="Filter and sort the KOL directory"
        className={`${rail} grid gap-4 pb-10 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end`}
      >
        <div>
          <label htmlFor={`${id}-q`} className="eyebrow mb-2 block text-faint">
            Search
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-faint"
              strokeWidth={1.5}
              aria-hidden
            />
            <input
              id={`${id}-q`}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, institution or specialty"
              autoComplete="off"
              className={`${field} ps-11`}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-state`} className="eyebrow mb-2 block text-faint">
            State
          </label>
          <select
            id={`${id}-state`}
            value={state}
            onChange={(e) => setState(e.target.value)}
            className={field}
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
          <label htmlFor={`${id}-inst`} className="eyebrow mb-2 block text-faint">
            Institution
          </label>
          <select
            id={`${id}-inst`}
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className={field}
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
          <label htmlFor={`${id}-sort`} className="eyebrow mb-2 block text-faint">
            Sort
          </label>
          <select
            id={`${id}-sort`}
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={field}
          >
            <option value="state">By state</option>
            <option value="name">By name</option>
            <option value="newest">Newest first</option>
          </select>
        </div>
      </div>

      <div className={`${rail} flex flex-wrap items-center gap-4 pb-5`}>
        <button
          type="button"
          onClick={() => setNewOnly((v) => !v)}
          aria-pressed={newOnly}
          className={`press rounded-[6px] px-4 py-2 text-body-s focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            newOnly ? 'bg-anchor text-ground' : 'text-dim shadow-[var(--shadow-card)] hover:text-text'
          }`}
        >
          New profiles only
        </button>
        {filtered ? (
          <button
            type="button"
            onClick={reset}
            className="press rounded-[6px] px-4 py-2 text-body-s text-muted2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Clear filters
          </button>
        ) : null}
        <p role="status" className="meta ms-auto text-faint">
          {shown.length} shown
        </p>
      </div>

      <div className={`${rail} ${embedded ? 'py-10' : 'py-14'}`}>
        {directory.loadState === 'loading' ? (
          <p
            role="status"
            className="rounded-[6px] px-8 py-16 text-center text-body-m text-muted2 shadow-[var(--shadow-card)]"
          >
            Reading the network…
          </p>
        ) : directory.loadState === 'error' ? (
          <EmptyState
            title="The directory did not load"
            body="Nothing came back from the network this time. Reload the page and it will try again."
            action={{ label: 'Reload', onClick: () => window.location.reload() }}
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title="No profiles match those filters"
            body="The network covers oncology and breast cancer specialists across seventeen states. Widen the filter to see more of it."
            action={{ label: 'Clear filters', onClick: reset }}
          />
        ) : grouped ? (
          <div className="space-y-16">
            {grouped.map(([st, list], i) => (
              <section key={st} aria-labelledby={`${id}-${st}`}>
                <div className="flex items-baseline gap-4 pb-4">
                  <span className="eyebrow hidden shrink-0 text-faint md:block">
                    {String(i + 1).padStart(2, '0')} / {st}
                  </span>
                  <h2 id={`${id}-${st}`} className="display text-display-s text-text">
                    {list[0].stateTitle}
                  </h2>
                  <span className="meta text-faint">
                    {list.length} {list.length === 1 ? 'KOL' : 'KOLs'}
                  </span>
                </div>
                <KolGrid list={list} />
              </section>
            ))}
          </div>
        ) : (
          <KolGrid list={shown} />
        )}
      </div>

      <section>
        <div className={`${rail} flex flex-wrap items-center justify-between gap-8 ${embedded ? 'py-10' : 'py-16'}`}>
          <div>
            <h2 className="display text-display-m text-text">Practising, and want to record?</h2>
            <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted2">
              CHM faculty are clinicians first. Sessions are recorded between clinics, in ninety
              minutes, with no script approval.
            </p>
          </div>
          <Button to="/contact" className="bg-signature text-ground hover:bg-signature hover:brightness-[0.94]">
            Talk to the editorial team
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
        </div>
      </section>
    </div>
  );
}

function KolGrid({ list }: { list: FlatKol[] }) {
  return (
    <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {list.map((k, i) => (
        <Reveal as="li" key={`${k.stateId}-${k.id}`} delay={Math.min(i, 6) * 50}>
          <KolCard k={k} />
        </Reveal>
      ))}
    </ul>
  );
}

function KolCard({ k }: { k: FlatKol }) {
  const profileHref = `/kol-network/profile/${k.id}`;
  const inst = institutionHint(k);

  return (
    /* The card is a container, not a link: it carries two
       distinct actions, so nesting them inside one link
       would make both unreachable. */
    <div className="lift card flex h-full flex-col p-6">
      <div className="flex items-start gap-4">
        {k.photoUrl ? (
          <img
            src={k.photoUrl}
            alt=""
            className="img-ring size-12 shrink-0 rounded-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2 text-body-s font-medium text-muted2"
          >
            {initials(k.name)}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="display text-body-m text-text">
            <Link to={profileHref} className="press rounded outline-offset-4 hover:text-signature">
              {k.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-body-s text-muted2" title={k.role}>
            {roleLead(k.role)}
          </p>
        </div>
        {/* Curator-featured takes the solid badge; newly added takes the
            tinted one. Both ride the same slot at the end of the row. */}
        {k.featured ? (
          <span className="eyebrow ms-auto shrink-0 rounded-[6px] bg-amber px-2.5 py-1 text-ground">
            Featured
          </span>
        ) : k.isNew ? (
          <span className="eyebrow ms-auto shrink-0 rounded-[6px] bg-amber/20 px-2.5 py-1 text-amber-ink">
            New
          </span>
        ) : null}
      </div>

      {/* State and institution share a row; the summary runs
          full width beneath them. */}
      <dl className="mt-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <dt className="eyebrow text-faint">State</dt>
            <dd className="mt-1 truncate text-body-s text-dim">{k.stateTitle}</dd>
          </div>
          <div className="min-w-0">
            <dt className="eyebrow text-faint">Institution</dt>
            <dd className="mt-1 truncate text-body-s text-dim" title={inst}>
              {inst}
            </dd>
          </div>
        </div>
        <div className="mt-4">
          <dt className="eyebrow flex items-center gap-2 text-faint">
            Summary
            {hasAiSummary(k) ? (
              <span className="inline-flex items-center gap-1 text-amber-ink">
                <Sparkles className="size-3" aria-hidden />
                AI
              </span>
            ) : null}
          </dt>
          <dd className="prose-lede mt-1 text-body-s text-muted2">{summaryOf(k)}</dd>
        </div>
      </dl>

      {/* Both actions name their destination, so each still
          makes sense read out of context. */}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          to={profileHref}
          className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-signature px-4 text-body-s text-ground hover:brightness-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Explore profile
          <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
        <Link
          to={kolCatalogBrowseHref(k)}
          className="press inline-flex h-9 items-center gap-1.5 rounded-[6px] px-4 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          View content
          <ArrowRight className="size-3.5" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}
