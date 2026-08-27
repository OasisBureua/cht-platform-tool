import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { catalogApi, type CatalogItem, type MediaHubClip } from '../../api/catalog';
import { webinarsApi, type WebinarItem } from '../../api/webinars';
import { isSessionExpired } from '../../utils/live-session-timing';
import DISEASE_AREAS from '../../data/disease-areas';
import { ChmMark } from '../../components/brand/ChmMark';
import { Button, Reveal } from '../../components/ui';
import { cn } from '../../lib/cn';

/**
 * For HCPs — transplanted from the design at chm-composio
 * (`src/app/for-hcps/page.tsx`). The design owns the copy, the sections
 * and their order; this file owns the Next -> Vite conversion (next/link
 * -> react-router `Link`, no metadata export) and the wiring of the
 * platform's real feeds into the design's slots:
 *
 *   hero panel   <- the newest catalog clips + the real disease areas
 *   01 Playlists <- GET /catalog/playlists
 *   02 Areas     <- src/data/disease-areas
 *   03 Live      <- GET /webinars
 *
 * Where a slot has no real counterpart (the three entry destinations,
 * every playlist blurb when the feed is empty) the design's own content
 * stands verbatim.
 */

const STALE = 5 * 60 * 1000;

/* ── design content ──────────────────────────────────────────
   Kept verbatim from the reference. `entry` is static in the
   design too: three destinations, not a feed. */

const entry = [
  { label: 'Clinical Conversations', href: '/catalog', cta: 'Conversations' },
  { label: 'CHM Office Hours', href: '/chm-office-hours', cta: 'View sessions' },
  { label: 'Live panels', href: '/live', cta: 'Join now' },
];

type PlaylistCard = {
  key: string;
  label: string;
  blurb: string;
  count: number;
  cover: string;
  href: string;
};

/** The design's own four biomarker playlists, for when the feed is empty. */
const DESIGN_PLAYLISTS: PlaylistCard[] = [
  {
    key: 'her2',
    label: 'HER2+',
    blurb: 'First-line sequencing, residual disease and the DESTINY-Breast readouts read side by side.',
    count: 12,
    cover: '/img/thumb-cleopatra.jpg',
    href: '/catalog/breast-cancer',
  },
  {
    key: 'hr',
    label: 'HR+',
    blurb: 'Endocrine sequencing after CDK4/6i, the PI3K/AKT pathway and proactive toxicity management.',
    count: 12,
    cover: '/img/thumb-db09.jpg',
    href: '/catalog/breast-cancer',
  },
  {
    key: 'residual-disease',
    label: 'Residual disease',
    blurb: 'Who needs adjuvant therapy after neoadjuvant treatment, and how the decision gets made.',
    count: 8,
    cover: '/img/thumb-patina.jpg',
    href: '/catalog/breast-cancer',
  },
  {
    key: 'ild-safety',
    label: 'ILD & safety',
    blurb: 'Early detection, monitoring cadence and the dose decisions that keep patients on therapy.',
    count: 7,
    cover: '/img/thumb-ild.jpg',
    href: '/catalog/breast-cancer',
  },
];

/**
 * One colour per disease state, as the design's library carries it. The
 * compatibility layer declares all three; `--color-metabolic` is the
 * platform's own third area, which the design's six do not include.
 */
const AREA_TONE: Record<string, string> = {
  'breast-cancer': 'var(--color-breast)',
  'lung-cancer': 'var(--color-lung)',
  'weight-loss': 'var(--color-metabolic)',
};

type PanelTile = { key: string; title: string; thumb: string; duration: string };

/** The design's four newest library tiles, for the hero panel's cold start. */
const DESIGN_TILES: PanelTile[] = [
  { key: 'neratinib-revisited', title: 'Neratinib revisited: is it time to reconsider an underused therapy?', thumb: '/img/thumb-cleopatra.jpg', duration: '7 MIN' },
  { key: 'parp-still-earns', title: 'Where PARP still earns its place', thumb: '/img/thumb-db09.jpg', duration: '23:18' },
  { key: 'bispecific-step-up', title: 'Step-up dosing without a transplant bed', thumb: '/img/thumb-ild.jpg', duration: '28:50' },
  { key: 'first-line-sequencing-her2', title: 'First-line sequencing in HER2+ mBC', thumb: '/img/thumb-cleopatra.jpg', duration: '18:40' },
];

/* ── data plumbing ───────────────────────────────────────── */

/**
 * Both feeds behind this page are merges: webinars come from DB programs
 * plus live Zoom sessions, playlists from the catalog and its WordPress
 * overlay. Either can hand back the same id twice, and the old page keyed
 * rows straight off `id`, which is what logged "two children with the same
 * key" and then rendered the rail unpredictably.
 *
 * Keeping the first row per id fixes that. A row with no id at all is kept
 * too — dropping content is the worse failure — and takes its index as a
 * key, widened until it cannot collide with a real id.
 */
function keyed<T extends { id?: string | null }>(rows: T[]): { key: string; row: T }[] {
  const seen = new Set<string>();
  const out: { key: string; row: T }[] = [];
  // A failing endpoint hands back an object, not a list, and the old page
  // took the whole section down with `rows.filter is not a function`.
  if (!Array.isArray(rows)) return out;
  rows.forEach((row, i) => {
    const id = (row.id ?? '').trim();
    if (id && seen.has(id)) return;
    let key = id || `row-${i}`;
    while (seen.has(key)) key = `${key}-${i}`;
    seen.add(key);
    out.push({ key, row });
  });
  return out;
}

function playlistToCard(p: CatalogItem, key: string): PlaylistCard {
  const names = p.videoNames ?? [];
  return {
    key,
    label: p.title,
    // A playlist carries no blurb, so the slot takes what the feed does
    // have: the first videos in it.
    blurb: names.slice(0, 3).join(' · '),
    count: p.videoCount || names.length,
    cover: p.thumbnailUrl || '/images/placeholder-playlist.svg',
    href: `/catalog/playlist/${p.id}`,
  };
}

function clipToTile(c: MediaHubClip, key: string): PanelTile {
  return {
    key,
    title: c.title,
    thumb: c.thumbnail_url || '/images/placeholder-playlist.svg',
    duration: clipDuration(c.duration_seconds),
  };
}

function clipDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function sessionDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function facultyLine(w: WebinarItem): string {
  if (w.hostDisplayName) return w.hostDisplayName;
  return (w.speakers ?? []).join(', ');
}

/* ── page ────────────────────────────────────────────────── */

export default function ForHCPs() {
  const { data: webinars = [], isLoading: webinarsLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: STALE,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: STALE,
  });

  const { data: clipsPage } = useQuery({
    queryKey: ['catalog', 'clips', 'hcp-hero'],
    queryFn: () => catalogApi.getClips({ sort_by: 'recent', limit: 4 }),
    staleTime: STALE,
  });

  const playlistCards = useMemo<PlaylistCard[]>(() => {
    const rows = keyed(playlists).map(({ key, row }) => playlistToCard(row, key));
    return rows.length > 0 ? rows.slice(0, 4) : DESIGN_PLAYLISTS;
  }, [playlists]);

  const tiles = useMemo<PanelTile[]>(() => {
    const rows = keyed(clipsPage?.items ?? []).map(({ key, row }) => clipToTile(row, key));
    return rows.length >= 4 ? rows.slice(0, 4) : DESIGN_TILES;
  }, [clipsPage]);

  /** The design lists what is coming up; recent replays stand in when nothing is. */
  const sessions = useMemo(() => {
    const rows = keyed(webinars)
      .filter(({ row }) => !!row.startTime)
      .sort(
        (a, b) =>
          new Date(a.row.startTime as string).getTime() -
          new Date(b.row.startTime as string).getTime(),
      );
    const live = rows.filter(({ row }) => !isSessionExpired(row.startTime, row.duration));
    if (live.length > 0) return live.slice(0, 5);
    return rows
      .filter(({ row }) => isSessionExpired(row.startTime, row.duration))
      .reverse()
      .slice(0, 5);
  }, [webinars]);

  return (
    <div className="min-h-screen bg-ground">
      <PageHead
        eyebrow="For HCPs"
        title="Built for the ten minutes you actually have"
        lede="Free for clinicians. Everything is organised by therapeutic area first, then by how much time you have: a full session, an audio cut for the drive, or a written explainer between patients."
        figure={<CatalogPanel tiles={tiles} />}
      >
        <div className="flex flex-wrap gap-3">
          <Button to="/join" className="font-mono tracking-[-0.011em]">
            Create a free account
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Button>
          <Button to="/catalog" variant="outline" className="font-mono tracking-[-0.011em]">
            Browse the library
          </Button>
        </div>
      </PageHead>

      <section>
        <div className="rail py-14">
          <ul className="grid gap-4 md:grid-cols-3">
            {entry.map((e, i) => (
              <Reveal as="li" key={e.label} delay={i * 60}>
                <Link
                  to={e.href}
                  className="press lift group flex h-full items-center justify-between gap-6 card p-6"
                >
                  <span>
                    <span className="eyebrow block text-amber-ink">New</span>
                    <span className="display mt-2 block text-body-l text-text">{e.label}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-body-s text-muted2 group-hover:text-text">
                    {e.cta}
                    <ArrowRight className="size-4" strokeWidth={1.75} />
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <Band labelledBy="hcp-playlists">
        <BandHead
          id="hcp-playlists"
          index="01 / Playlists"
          title="Featured biomarker playlists"
          seeAll={{ noun: 'playlists', href: '/catalog' }}
        />
        {playlistsLoading && playlists.length === 0 ? (
          <Pending label="Loading playlists" />
        ) : (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {playlistCards.map((p, i) => (
              <Reveal as="li" key={p.key} delay={i * 60}>
                <Link
                  to={p.href}
                  className="press lift group flex h-full flex-col gap-5 card p-5"
                >
                  <Thumb src={p.cover} className="aspect-video w-full" />
                  <div className="flex flex-1 flex-col">
                    <h3 className="display text-body-l text-text">{p.label}</h3>
                    {p.blurb ? (
                      <p className="prose-lede mt-2 line-clamp-3 text-body-s text-muted2">{p.blurb}</p>
                    ) : null}
                    <p className="meta mt-auto pt-6 text-faint">
                      {p.count ? `Play all · ${p.count} videos` : 'Play all'}
                    </p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </Band>

      <Band labelledBy="hcp-areas">
        <BandHead
          id="hcp-areas"
          index="02 / Areas"
          title="View treatment-specific content"
          sub="Expert-led education, conversations and resources by therapeutic area."
        />
        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {DISEASE_AREAS.map((a, i) => (
            <Reveal as="li" key={a.slug} delay={i * 70}>
              <Link
                to={`/catalog/${a.slug}`}
                className="press lift group flex h-full flex-col card p-7"
              >
                <h3 className="display text-display-s text-text">{a.title}</h3>
                <p className="prose-lede mt-3 text-body-s text-muted2">{a.description}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-8 text-body-s text-muted2 group-hover:text-text">
                  Explore treatment
                  <ArrowRight className="size-4" strokeWidth={1.75} />
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </Band>

      <Band labelledBy="hcp-live">
        <BandHead
          id="hcp-live"
          index="03 / Live"
          title="Webinars"
          seeAll={{ noun: 'sessions', href: '/live' }}
        />
        {webinarsLoading && webinars.length === 0 ? (
          <Pending label="Loading sessions" />
        ) : sessions.length === 0 ? (
          <div className="card mt-10 px-8 py-16 text-center">
            <p className="display text-display-s text-text">No sessions scheduled</p>
            <p className="prose-lede mx-auto mt-3 max-w-[34rem] text-body-m text-muted2">
              Check back soon for upcoming sessions.
            </p>
            <div className="mt-7 flex justify-center">
              <Button to="/live" variant="outline" className="font-mono tracking-[-0.011em]">
                See the schedule
              </Button>
            </div>
          </div>
        ) : (
          <ul className="mt-10 space-y-3">
            {sessions.map(({ key, row: s }, i) => {
              const start = new Date(s.startTime as string);
              const meta = [format(start, 'h:mm a'), sessionDuration(s.duration)]
                .filter(Boolean)
                .join(' · ');
              const faculty = facultyLine(s);
              return (
                <Reveal as="li" key={key} delay={i * 50}>
                  <Link
                    to={`/live/${s.id}`}
                    className="press group grid items-center gap-x-8 gap-y-2 py-6 md:grid-cols-[12rem_1fr_auto]"
                  >
                    <div>
                      <p className="meta text-signature">{format(start, 'EEE, MMM d, yyyy')}</p>
                      {meta ? <p className="meta mt-1 text-faint">{meta}</p> : null}
                    </div>
                    <div>
                      <h3 className="display text-body-l text-text">{s.title}</h3>
                      {faculty ? <p className="mt-1 text-body-s text-muted2">{faculty}</p> : null}
                    </div>
                    <span className="inline-flex items-center gap-1.5 justify-self-start text-body-s text-muted2 group-hover:text-text md:justify-self-end">
                      Learn more
                      <ArrowRight className="size-4" strokeWidth={1.75} />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        )}
      </Band>
    </div>
  );
}

/* =========================================================
   Design chrome, transplanted from chm-composio's shared
   components. The shared `SectionHead` in components/ui is
   the platform's own head — index above the title, semibold
   sans — so the design's version (mono index parked at a
   fixed width beside a display title, one "see all" pill)
   is carried here rather than being flattened into it.
   ========================================================= */

/**
 * Inner-page masthead. With a `figure` the hero splits into copy on the
 * leading side and a raised product panel on the trailing side.
 */
function PageHead({
  eyebrow,
  title,
  lede,
  children,
  figure,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  children?: ReactNode;
  figure?: ReactNode;
}) {
  const copy = (
    <>
      <p className="eyebrow text-muted2">{eyebrow}</p>
      <h1 className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
        {title}
      </h1>
      {lede ? <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">{lede}</p> : null}
      {children ? <div className="mt-9">{children}</div> : null}
    </>
  );

  if (!figure) {
    return <section className="rail pt-16 pb-14 md:pt-20 md:pb-16">{copy}</section>;
  }

  return (
    <section className="rail pt-14 pb-12 md:pt-16 md:pb-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
        <div>{copy}</div>
        <div>{figure}</div>
      </div>
    </section>
  );
}

/** Full-bleed band; the inner rail carries the margins. */
function Band({
  children,
  className = '',
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section aria-labelledby={labelledBy}>
      <div className={cn('rail py-16 md:py-24', className)}>{children}</div>
    </section>
  );
}

/**
 * Section chrome: a mono index label on the leading edge, the heading,
 * and one "see all" affordance. The index keeps a fixed width so every
 * section title on the page starts at the same x.
 */
function BandHead({
  index,
  title,
  sub,
  seeAll,
  id,
}: {
  index?: string;
  title: string;
  sub?: string;
  seeAll?: { noun: string; href: string };
  id?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-6">
          {index ? <p className="eyebrow hidden w-28 shrink-0 text-muted2 md:block">{index}</p> : null}
          <h2 id={id} className="display text-display-m text-text">
            {title}
          </h2>
        </div>
        {seeAll ? (
          <Link
            to={seeAll.href}
            className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-[var(--shadow-card)] hover:bg-ground hover:text-text hover:shadow-[var(--shadow-card-hover)]"
          >
            See all {seeAll.noun}
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      {sub ? (
        <p className="prose-lede mt-4 max-w-[52ch] text-body-m text-muted2 md:ms-[8.5rem]">{sub}</p>
      ) : null}
    </div>
  );
}

/** A state the design's static data never has: a feed still in flight. */
function Pending({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-16" role="status" aria-label={label}>
      <Loader2 className="size-8 animate-spin text-faint" />
    </div>
  );
}

function Thumb({
  src,
  duration,
  className = '',
  rounded = 'rounded-[6px]',
}: {
  src: string;
  duration?: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden bg-surface-2', rounded, className)}>
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        /* Tailwind v3 renders `scale-*` as a transform, so the transition
           names transform where the v4 original named `scale`. */
        className="absolute inset-0 size-full object-cover opacity-90 transition-[transform,opacity] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.03] group-hover:opacity-100"
      />
      {/* Permanently dark region from here down: the scrim is fixed black
          whatever the appearance, so its labels are fixed white. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
      <div className="img-ring absolute inset-0 rounded-[inherit]" />
      <ChmMark className="absolute bottom-3 start-3 size-5 text-white/80" />
      {duration ? <span className="meta absolute end-3 bottom-3 text-white/80">{duration}</span> : null}
    </div>
  );
}

/* ── hero panel ──────────────────────────────────────────── */

/**
 * Shared frame for the inner-page hero visual: a raised panel on a soft
 * brand-tinted field, with a bevel highlight along the top edge. Depth
 * only, no outlines.
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
      {/* The design's dots are white/15, which is invisible on the light
          ground; the hairline token is the same weight in both. */}
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="size-2.5 rounded-full bg-hairline-strong" />
      <span className="meta ms-2 text-faint">{label}</span>
    </div>
  );
}

/** The content library as the product: real areas, real newest clips. */
function CatalogPanel({ tiles }: { tiles: PanelTile[] }) {
  return (
    <HeroPanel>
      <Chrome label="chm / catalog" />
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {DISEASE_AREAS.slice(0, 4).map((a, i) => (
            <span
              key={a.slug}
              className={cn(
                'rounded-[6px] px-2.5 py-1 text-[0.6875rem]',
                i === 0 ? 'text-on-bright' : 'bg-surface text-muted2',
              )}
              style={i === 0 ? { background: AREA_TONE[a.slug] ?? 'var(--color-anchor)' } : undefined}
            >
              {a.title}
            </span>
          ))}
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {tiles.map((t) => (
            <li key={t.key} className="overflow-hidden rounded-[6px] bg-surface">
              <span className="relative block aspect-video">
                <img
                  src={t.thumb}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 size-full object-cover"
                />
                {/* Fixed-black scrim, so the duration on it is fixed white. */}
                <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                {t.duration ? (
                  <span className="meta absolute bottom-2 end-2 text-white/90">{t.duration}</span>
                ) : null}
              </span>
              <span className="block truncate px-2.5 py-2 text-[0.6875rem] text-text">{t.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </HeroPanel>
  );
}
