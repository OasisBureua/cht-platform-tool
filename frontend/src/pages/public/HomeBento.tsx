import { Fragment, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog';
import { getShortClipId, extractYoutubeVideoIdFromUrl } from '../../utils/clipUrl';
import { HomeHero } from '../../components/home/HomeHero';
import { DiseaseClusterCard } from '../../components/home/DiseaseClusterCard';
import { FormatBento } from '../../components/home/FormatBento';
import { LatestTabs } from '../../components/home/LatestTabs';
import { Thumb } from '../../components/ui/Thumb';
import { ChmMark } from '../../components/brand/ChmMark';
import { useKolDirectory } from '../../hooks/useKolDirectory';
import { kolStaticEnrichment, type DolEntry } from '../../data/dol-network';
import DISEASE_AREAS from '../../data/disease-areas';
import { PODCAST_SHOWS } from '../../data/podcastsCatalog';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import { Reveal } from '../../components/ui';

type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
  youtubeUrl?: string;
};

/** Shown when `/catalog/random-videos` returns [] so the rail is never blank */
const FALLBACK_FEATURED: FeaturedVideo[] = [
  {
    id: 'home-placeholder-1',
    title: 'Browse clinical conversations in the library',
    imageUrl: '/img/thumb-cleopatra.jpg',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-2',
    title: 'Expert-led education across therapeutic areas',
    imageUrl: '/img/thumb-db09.jpg',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-3',
    title: 'Webinars, protocols, and patient resources',
    imageUrl: '/img/thumb-ild.jpg',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-4',
    title: 'Short cuts from the sessions that ran this month',
    imageUrl: '/img/thumb-patina.jpg',
    youtubeUrl: undefined,
  },
];

/* ── section chrome ──────────────────────────────────────────────────── */

/** Full-bleed band; the inner rail carries the page gutter. */
function Band({
  children,
  labelledBy,
  className = '',
  pad = 'py-10 md:py-14',
}: {
  children: ReactNode;
  labelledBy?: string;
  className?: string;
  /**
   * Overridable, because a band that follows the hero needs less top
   * space than one that follows another band.
   *
   * The padding is symmetric and every band carries it, so the gap you
   * see between two sections is the sum of both: 56 + 56 on desktop.
   * That is the number to reason about, not the 14. It was py-24
   * before, which stacked to 192px of nothing between every section.
   */
  pad?: string;
}) {
  return (
    <section aria-labelledby={labelledBy}>
      <div className={`rail ${pad} ${className}`}>{children}</div>
    </section>
  );
}

function Eyebrow({
  children,
  tone = 'faint',
  className = '',
}: {
  children: ReactNode;
  tone?: 'faint' | 'cyan' | 'amber';
  className?: string;
}) {
  const tones = { faint: 'text-muted2', cyan: 'text-anchor', amber: 'text-amber' };
  return <p className={`eyebrow ${tones[tone]} ${className}`}>{children}</p>;
}

/**
 * Section chrome: a mono index label on the leading edge, the heading,
 * and the one "see all" affordance a band is allowed. The index keeps a
 * fixed width so every section title on the page starts at the same x.
 */
function SectionHead({
  id,
  index,
  title,
  sub,
  seeAll,
}: {
  id?: string;
  index?: string;
  title: string;
  sub?: string;
  seeAll?: { noun: string; to: string };
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-center gap-6">
          {index ? <Eyebrow className="hidden w-28 shrink-0 md:block">{index}</Eyebrow> : null}
          <h2 id={id} className="display text-display-m text-text">
            {title}
          </h2>
        </div>
        {seeAll ? (
          <Link
            to={seeAll.to}
            className="press inline-flex h-10 shrink-0 items-center gap-2 rounded-[6px] bg-surface px-5 text-body-s text-dim shadow-card hover:bg-ground hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            See all {seeAll.noun}
            <Arrow className="size-4" strokeWidth={1.75} />
          </Link>
        ) : null}
      </div>
      {sub ? (
        <p className="prose-lede mt-4 max-w-[52ch] text-body-m text-muted2 md:ms-[8.5rem]">{sub}</p>
      ) : null}
    </div>
  );
}

/** Reading-direction glyph: mirrors under dir="rtl". */
function Arrow({ className = '', strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={`shrink-0 rtl:-scale-x-100 ${className}`}
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/**
 * The design's button: a mono label at control height, filled with the
 * CTA token or reading as a control through elevation alone.
 */
function Btn({
  to,
  children,
  variant = 'cta',
  withArrow = false,
}: {
  to: string;
  children: ReactNode;
  variant?: 'cta' | 'outline';
  withArrow?: boolean;
}) {
  const fill =
    variant === 'cta'
      ? 'bg-cta text-ground hover:bg-cta-deep'
      : 'bg-surface text-text shadow-card hover:bg-ground hover:shadow-card-hover';
  return (
    <Link
      to={to}
      className={`press inline-flex h-11 items-center justify-center gap-2 rounded-[6px] ps-6 font-mono text-[0.875rem] tracking-[-0.011em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        withArrow ? 'pe-5' : 'pe-6'
      } ${fill}`}
    >
      {children}
      {withArrow ? <Arrow className="size-4" strokeWidth={1.75} /> : null}
    </Link>
  );
}

/** A poster with the mark, a scrim and an optional runtime on it. */

/* ── page content ────────────────────────────────────────────────────── */

const MOMENTS = [
  { t: 'Oncotype or Prosigna, which is more informative?', d: '4:12' },
  { t: 'Neoadjuvant or adjuvant T-DXd?', d: '3:48' },
  { t: 'First-line HER2+ metastatic breast cancer', d: '5:20' },
  { t: 'Do BRCA patients benefit from ADCs?', d: '4:02' },
];

const ARTICLES = [
  {
    slug: 'neratinib-revisited',
    kicker: 'Perspective',
    title: 'Neratinib revisited: time to reconsider an underused therapy?',
    dek: 'Recurrence remains a clinically important challenge in high-risk HER2-positive early breast cancer. What the extended adjuvant data still supports.',
    read: '7 min',
  },
  {
    slug: 'gedatolisib-approval',
    kicker: 'Regulatory',
    title: 'FDA approves gedatolisib for HR+/HER2- PIK3CA wild-type advanced breast cancer',
    dek: 'Approved in combination with fulvestrant. What the label covers, and which patients it actually changes the plan for.',
    read: '5 min',
  },
  {
    slug: 'trodelvy-1l-tnbc',
    kicker: 'Regulatory',
    title: 'Trodelvy gains first-line approval in metastatic triple-negative breast cancer',
    dek: 'Expanding options in a setting that has had few. Where it sits against the current first-line standard.',
    read: '6 min',
  },
  {
    slug: 'orserdu-combination',
    kicker: 'Data',
    title: 'New combination data in ESR1-mutated metastatic breast cancer',
    dek: 'Hormone receptor-positive treatment is increasingly a combination question. What the latest readout adds.',
    read: '6 min',
  },
];

/**
 * The podcast network. The copy is the design's; the cover art is the
 * platform's real show artwork for the two series it actually publishes,
 * matched on `podcastId`.
 */
const SHOWS: {
  slug: string;
  title: string;
  tagline: string;
  hosts: string;
  episodes: number;
  tone: string;
  cover: string;
  podcastId?: string;
  spanish?: boolean;
}[] = [
  {
    slug: 'breast-friends',
    title: 'The Breast Friends Podcast',
    tagline: 'Breaking the status quo in breast cancer care',
    hosts: 'With Dr. Hope Rugo and guests',
    episodes: 6,
    tone: 'var(--color-breast)',
    cover: '/img/cells-warm.jpg',
    podcastId: 'breast-friends',
  },
  {
    slug: 'cancer-unfiltered',
    title: 'Cancer Unfiltered',
    tagline: 'Shifting paradigms, argued in public',
    hosts: 'Drs. Komal Jhaveri & Neil Iyengar',
    episodes: 4,
    tone: 'var(--color-signature)',
    cover: '/img/cells-blue.jpg',
    podcastId: 'cancer-unfiltered',
  },
  {
    slug: 'big-c-energy',
    title: 'Big C Energy',
    tagline: 'Cancer, from the people who lived it',
    hosts: 'Patient and public voices',
    episodes: 4,
    tone: 'var(--color-cta)',
    cover: '/img/thumb-patina.jpg',
    podcastId: 'big-c-energy',
  },
  {
    slug: 'tetalks',
    title: 'TeTalks',
    tagline: 'Oncología en español',
    hosts: 'Dras. Marcela Mazo Canola y Ana Sandoval León',
    episodes: 2,
    tone: 'var(--color-lung)',
    cover: '/img/thumb-db09.jpg',
    podcastId: 'tetalks',
    spanish: true,
  },
];

/**
 * Disease states the design carries that the platform's own
 * `DISEASE_AREAS` does not, kept verbatim and marked as not yet live.
 */
/**
 * The canvas reads a raw HSL triplet, not a resolved `var()`, so the
 * cluster needs the token name rather than the pill's CSS colour. These
 * are the `ink` set, which deepens on the light ground and brightens on
 * the dark one.
 */
const AREA_CANVAS_TOKENS: Record<string, string> = {'breast-cancer': '--ink-pink', 'lung-cancer': '--ink-purple', 'weight-loss': '--ink-coral', 'gi': '--anchor', 'gu': '--ink-cyan', 'hematology': '--ink-green', 'gynecologic': '--ink-purple'};

const DESIGN_ONLY_AREAS = [
  { slug: 'gi', label: 'GI', tone: 'var(--color-gi)' },
  { slug: 'gu', label: 'GU', tone: 'var(--color-gu)' },
  { slug: 'hematology', label: 'Hematology', tone: 'var(--color-heme)' },
  { slug: 'gynecologic', label: 'Gynecologic', tone: 'var(--color-gyn)' },
];

/**
 * One colour per disease state, carried through the library. The pill is
 * a gradient from the state's own tone toward a second hue; the design's
 * six all run toward blue, and the amber one runs toward coral so it
 * does not pass through mud on the way.
 */
const AREA_TONES: Record<string, { tone: string; mix?: string }> = {
  'breast-cancer': { tone: 'var(--color-breast)' },
  'lung-cancer': { tone: 'var(--color-lung)' },
  'weight-loss': { tone: 'var(--color-metabolic)', mix: 'var(--color-metabolic-mix)' },
};

/**
 * The biomarker vocabulary. Labels and counts are the design's; each
 * chip filters the real catalog on the namespaced MediaHub tag the
 * platform files that biomarker under.
 */
const BIOMARKERS = [
  { label: 'HER2+', count: 12, tag: 'biomarker:HER2+' },
  { label: 'HR+', count: 12, tag: 'biomarker:HR+' },
  { label: 'HER2-Low / Ultra-Low', count: 9, tag: 'biomarker:HER2-low,biomarker:HER2-ultralow' },
  { label: 'Triple Negative', count: 11, tag: 'biomarker:TNBC' },
  { label: 'High Risk', count: 7, tag: 'biomarker:High-Risk / CNS' },
];

/** The video cut of the session, shown as the document in front. */


const INITIAL_TONES = [
  'var(--color-cyan)',
  'var(--color-pink)',
  'var(--color-purple)',
  'var(--color-coral)',
  'var(--color-glow)',
];

/* The stat band's grid: faint rules that pulse along their length on
   staggered, non-repeating durations. */

/** Initials fallback for a contributor with no headshot on file. */
function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 3);
}

/** The card sub-line: the institution when we have one, else the role. */
function institutionLine(k: DolEntry): string {
  const inst = k.institution?.trim();
  if (inst && inst !== '-') return inst;
  const affiliation = k.intel?.affiliation?.split('·')[0]?.trim();
  if (affiliation) return affiliation;
  const roleLead = k.role.split(/[.;]/)[0]?.trim() ?? k.role;
  return roleLead.length > 46 ? `${roleLead.slice(0, 45)}…` : roleLead;
}

export default function HomeBento({ order = 'c' }: { order?: 'a' | 'c' } = {}) {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  /**
   * Catalogue totals for the format tabs. `limit: 1` because only the
   * `total` is wanted — the panels render their own slice from data
   * they already hold, so this must not pull a second copy of it.
   *
   * The tabs count the library, not the cards on screen. A tab reading
   * the panel length would just say "4" three times, which tells a
   * clinician nothing about whether the library is worth an account.
   */
  const { data: totals } = useQuery({
    queryKey: ['catalog', 'format-totals'],
    queryFn: async () => {
      const [clips, posts] = await Promise.all([
        catalogApi.getClips({ limit: 1, dedup_by: 'shoot' }),
        catalogApi.getWordPressPosts({ limit: 1 }),
      ]);
      // A zero here means the call came back empty, not that the
      // library is empty. Undefined, so the tab shows no badge and the
      // footer falls back to copy that names no number.
      return { video: clips.total || undefined, editorial: posts.total || undefined };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: randomVideosData, isLoading: randomVideosLoading } = useQuery({
    queryKey: ['catalog', 'random-videos'],
    queryFn: () => catalogApi.getRandomVideos(8),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });
  const randomVideos = Array.isArray(randomVideosData) ? randomVideosData : [];

  const [brokenFeaturedIds, setBrokenFeaturedIds] = useState<Set<string>>(() => new Set());
  const markBroken = (id: string) =>
    setBrokenFeaturedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });

  const featuredVideos: FeaturedVideo[] = useMemo(() => {
    const mapped = randomVideos
      .filter((v) => extractYoutubeVideoIdFromUrl(v.youtubeUrl))
      .filter((v) => !brokenFeaturedIds.has(v.id))
      .map((v) => ({
        id: v.id,
        title: v.title,
        imageUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
        youtubeUrl: v.youtubeUrl,
      }));
    if (mapped.length > 0) return mapped;
    if (brokenFeaturedIds.size > 0) return [];
    return randomVideosLoading ? [] : FALLBACK_FEATURED;
  }, [randomVideos, randomVideosLoading, brokenFeaturedIds]);

  const clipHref = (v: FeaturedVideo) =>
    v.id.startsWith('home-placeholder') ? '/catalog?view=clips' : `/catalog/clip/${getShortClipId(v.id)}`;

  /* Faculty: the live directory, falling back to the static roster the
     platform ships so the row is never empty while the call is in
     flight. The portraits lead, because the row is a row of portraits. */
  const { regions, loadState } = useKolDirectory({ surface: 'public' });
  const faculty: DolEntry[] = useMemo(() => {
    const live = regions.flatMap((r) => r.entries);
    const roster = live.length > 0 ? live : kolStaticEnrichment;
    return [...roster].sort((a, b) => Number(!!b.photoUrl) - Number(!!a.photoUrl)).slice(0, 5);
  }, [regions]);

  /* The two series the platform actually publishes carry their own
     artwork; the rest of the network keeps the design's covers. */
  const shows = useMemo(
    () =>
      SHOWS.map((s) => {
        const real = s.podcastId ? PODCAST_SHOWS.find((p) => p.id === s.podcastId) : undefined;
        return { ...s, cover: real?.image ?? s.cover };
      }),
    [],
  );

  const areas = useMemo(
    () => [
      ...DISEASE_AREAS.map((a) => ({
        slug: a.slug,
        label: a.title,
        tone: AREA_TONES[a.slug]?.tone ?? 'var(--color-gi)',
        token: AREA_CANVAS_TOKENS[a.slug] ?? '--anchor',
        mix: AREA_TONES[a.slug]?.mix ?? 'var(--color-blue)',
        live: a.active,
        to: a.active ? `/catalog/${a.slug}` : undefined,
      })),
      ...DESIGN_ONLY_AREAS.map((a) => ({
        ...a,
        token: AREA_CANVAS_TOKENS[a.slug] ?? '--anchor',
        mix: 'var(--color-blue)',
        live: false,
        to: undefined,
      })),
    ],
    [],
  );

  const episodeTotal = useMemo(() => SHOWS.reduce((n, show) => n + show.episodes, 0), []);

  const sessionPoster = featuredVideos[0]?.imageUrl ?? '/img/thumb-cleopatra.jpg';

  /* Section blocks, keyed so the page can be resequenced without
     moving any of them. Order A: no two horizontal scrollers touch. `now`, `shows` and
     `areas` are the three scrollers, so a grid or a list sits between
     each pair. Ends on faces rather than on a filter row. */
  /* Split out of their own sections so order C's tabbed block can
     render the same content without re-implementing a single card. */
  const nowBody = (
    <>
      <Reveal className="mt-12">
        {/* The rail reveals as one block. Revealing each card meant
            anything scrolled off to the right never intersected the
            viewport, so it stayed blank until you swiped it in, and a
            per-card stagger fights the swipe anyway. */}
        <div className="scrollbar-none bleed-x overflow-x-auto">
          <ul className="flex snap-x snap-mandatory gap-4">
            {(randomVideosLoading ? Array.from({ length: 4 }) : featuredVideos.slice(0, 8)).map(
              (entry, i) => {
                const v = entry as FeaturedVideo | undefined;
                return (
                  <li
                    key={v?.id ?? `skeleton-${i}`}
                    className="w-[80%] shrink-0 snap-start sm:w-[45%] md:w-[31%] lg:w-[22.5%]"
                  >
                    {v ? (
                      <Link
                        to={clipHref(v)}
                        className="press lift group flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <div className="relative">
                          <Thumb
                            src={v.imageUrl}
                            className="aspect-video w-full"
                            onError={
                              v.id.startsWith('home-placeholder') ? undefined : () => markBroken(v.id)
                            }
                          />
                          <div className="absolute top-3 start-3">
                            <span className="eyebrow inline-flex h-6 items-center rounded-[6px] bg-ground/70 px-3 text-text backdrop-blur-sm">
                              Video
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-1 flex-col px-1 pb-1">
                          <h3 className="display line-clamp-2 text-body-m text-text">{v.title}</h3>
                          {/* Tags are spans, not links: the card is already
                              one link, and nesting a second inside it is
                              invalid. They read as the session's own labels. */}
                          <ul className="mt-3 flex flex-wrap gap-1.5">
                            <li
                              className="inline-flex h-6 items-center rounded-[6px] px-2 text-[0.6875rem] leading-none"
                              style={{ background: 'var(--color-cyan)', color: 'var(--color-on-bright)' }}
                            >
                              Oncology
                            </li>
                            <li
                              className="inline-flex h-6 items-center rounded-[6px] px-2 text-[0.6875rem] leading-none"
                              style={{ background: 'var(--color-pink)', color: 'var(--color-on-bright)' }}
                            >
                              {v.youtubeUrl ? 'YouTube' : 'Conversation'}
                            </li>
                          </ul>
                          <p className="meta mt-auto pt-4 tabular-nums text-faint">Full session</p>
                        </div>
                      </Link>
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-full flex-col gap-4 rounded-[6px] p-4 shadow-card"
                      >
                        <div className="aspect-video w-full rounded-[6px] bg-surface-2" />
                        <div className="space-y-2 px-1 pb-1">
                          <div className="h-3 w-4/5 rounded-[6px] bg-surface-2" />
                          <div className="h-3 w-3/5 rounded-[6px] bg-surface-2" />
                        </div>
                      </div>
                    )}
                  </li>
                );
              },
            )}
          </ul>
        </div>
      </Reveal>
    </>
  );
  const showsBody = (
    <>
      <div className="mt-[2.375rem]">
        {/* Headroom lives inside the scroller: overflow-x also clips
            vertically, which would cut off the hover lift. */}
        <div className="-my-5">
          <ul className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-4 overflow-x-auto py-5">
            {shows.map((s) => (
              <li key={s.slug} className="w-[15rem] shrink-0 snap-start">
                <Link
                  to="/chm-office-hours"
                  className="press lift group flex h-full flex-col overflow-hidden rounded-[6px] bg-surface shadow-card hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={s.cover}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover transition-[scale] duration-300 ease-[var(--ease-out-strong)] group-hover:scale-[1.04]"
                    />
                    <span
                      aria-hidden
                      className="absolute bottom-3 start-3 grid size-8 place-items-center rounded-[6px] bg-black/35 backdrop-blur-sm"
                    >
                      <ChmMark className="size-5 text-white" />
                    </span>
                    {s.spanish ? (
                      <span className="eyebrow absolute top-3 end-3 rounded-[6px] bg-white/90 px-2.5 py-1 text-on-bright">
                        Español
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
                    <h3 className="display text-body-m text-text">{s.title}</h3>
                    <p className="prose-lede mt-1 line-clamp-2 max-w-[38ch] text-body-s text-muted2">
                      {s.tagline}
                    </p>
                    <p className="meta mt-3 text-faint">
                      {s.episodes} episodes · {s.hosts}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
  const articlesBody = (
    <>
      <ul className="mt-12 space-y-3">
        {ARTICLES.map((a, i) => (
          <Reveal as="li" key={a.slug} delay={i * 45}>
            <Link
              to="/catalog"
              className="press group grid items-baseline gap-x-8 gap-y-2 py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:grid-cols-[9rem_1fr_5rem]"
            >
              <span className="eyebrow text-amber-ink">{a.kicker}</span>
              <span>
                <h3 className="display text-display-s text-text">{a.title}</h3>
                <p className="prose-lede mt-2 max-w-[62ch] text-body-s text-muted2">{a.dek}</p>
              </span>
              <span className="meta text-faint md:text-end">{a.read}</span>
            </Link>
          </Reveal>
        ))}
      </ul>
    </>
  );

  const SECTIONS: Record<string, ReactNode> = {
    engine: (
      <>
        <Band labelledBy="engine-heading" pad="pt-4 pb-10 md:pt-6 md:pb-14">
          <h2 id="engine-heading" className="sr-only">
            One recording, three formats
          </h2>
          <Reveal>
            <FormatBento poster={sessionPoster} />
          </Reveal>
        </Band>
      </>
    ),
    now: (
      <>
        {/* ── Now on CHM ───────────────────────────────────── */}
        <Band labelledBy="now-heading">
          <SectionHead
            id="now-heading"
            index="01 / Latest"
            title="Now on CHM"
            sub="The most recent across every format."
            seeAll={{ noun: 'content', to: '/catalog' }}
          />
          {nowBody}
        </Band>
      </>
    ),
    moment: (
      <>
        {/* ── This Moment in Medicine ──────────────────────── */}
        <Band labelledBy="moment-heading">
          <SectionHead
            id="moment-heading"
            index="04 / Series"
            title="This Moment in Medicine"
            sub="Short answers to the questions that come up between patients."
            seeAll={{ noun: 'episodes', to: '/catalog' }}
          />
          <ol className="mt-12 grid gap-3 lg:grid-cols-2">
            {MOMENTS.map((m, i) => {
              const poster = featuredVideos.length ? featuredVideos[i % featuredVideos.length] : undefined;
              return (
                <Reveal as="li" key={m.t} delay={i * 55}>
                  <Link
                    to={poster ? clipHref(poster) : '/catalog'}
                    className="press card group flex items-center gap-5 p-3 ps-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="meta w-6 shrink-0 tabular-nums text-faint">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="display block text-body-m text-text">{m.t}</span>
                      <span className="meta mt-1 block tabular-nums text-faint">{m.d}</span>
                    </span>
                    {poster ? (
                      <Thumb src={poster.imageUrl} className="hidden h-16 w-28 shrink-0 sm:block" />
                    ) : null}
                  </Link>
                </Reveal>
              );
            })}
          </ol>
        </Band>
      </>
    ),
    shows: (
      <>
        {/* ── Podcast network ──────────────────────────────── */}
        <Band labelledBy="shows-heading">
          <SectionHead
            id="shows-heading"
            index="03 / Podcasts"
            title="CHM Podcast Network"
            sub="Four shows, each with its own voice and its own audience."
            seeAll={{ noun: 'shows', to: '/chm-office-hours' }}
          />
          {showsBody}
        </Band>
      </>
    ),
    articles: (
      <>
        {/* ── Editorial ────────────────────────────────────── */}
        <Band labelledBy="articles-heading">
          <SectionHead
            id="articles-heading"
            index="05 / Editorial"
            title="Recent articles"
            seeAll={{ noun: 'articles', to: '/catalog' }}
          />
          {articlesBody}
        </Band>
      </>
    ),
    areas: (
      <>
        {/* ── Explore by disease state ─────────────────────── */}
        <Band labelledBy="areas-heading">
          <SectionHead
            id="areas-heading"
            index="07 / Browse"
            title="Explore by disease state"
            sub="Each cluster is sized by what the area actually holds."
          />
        <div className="mt-12">
          {/* overflow-x-auto clips vertically too, so the hover lift needs
              headroom inside the scroller rather than margin outside it. */}
          <div className="-my-5">
            <div className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto py-5">
              {areas.map((a) => (
                <DiseaseClusterCard
                  key={a.slug}
                  label={a.label}
                  sub={a.live ? 'Video, podcast, editorial and live' : 'In production'}
                  tone={a.token}
                  weight={a.live ? 1 : 0}
                  to={a.to}
                />
              ))}
            </div>
          </div>
        </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {BIOMARKERS.map((b) => (
              <Link
                key={b.label}
                to={`/catalog?tag=${encodeURIComponent(b.tag)}`}
                className="press inline-flex h-9 items-center gap-2 rounded-[6px] px-4 text-body-s text-dim shadow-card hover:text-text hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {b.label}
                <span className="meta text-faint">{b.count}</span>
              </Link>
            ))}
          </div>
        </Band>
      </>
    ),
    latest: (
      <>
        {/* ── Latest, all formats ──────────────────────────── */}
        <Band labelledBy="latest-heading">
          <SectionHead
            id="latest-heading"
            index="03 / Latest"
            title="Everything new, in every format"
            sub="One section instead of three. The format is a filter, not another scroll."
          />
          <LatestTabs
            tracks={[
              {
                key: 'video',
                label: 'Video',
                count: totals?.video,
                panel: nowBody,
                more: {
                  to: '/catalog',
                  label: totals?.video ? `Browse all ${totals.video} sessions` : 'Browse the library',
                },
              },
              {
                key: 'podcast',
                label: 'Podcasts',
                count: episodeTotal,
                panel: showsBody,
                more: { to: '/podcasts', label: `All ${SHOWS.length} shows` },
              },
              {
                key: 'editorial',
                label: 'Editorial',
                count: totals?.editorial,
                panel: articlesBody,
                more: {
                  to: '/catalog',
                  label: totals?.editorial ? `Read all ${totals.editorial} articles` : 'Read the archive',
                },
              },
            ]}
          />
        </Band>
      </>
    ),
    kol: (
      <>
        {/* ── In conversation ──────────────────────────────── */}
        <Band labelledBy="kol-heading">
          <SectionHead
            id="kol-heading"
            index="06 / Faculty"
            title="In conversation"
            sub="Practising specialists who bring their own audiences."
            seeAll={{ noun: 'profiles', to: '/kol-network' }}
          />
          <ul className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {faculty.map((k, i) => (
              <Reveal as="li" key={k.id} delay={i * 50}>
                <Link
                  to={`/kol-network/profile/${encodeURIComponent(k.id)}`}
                  className="press group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {k.photoUrl ? (
                    <img
                      src={k.photoUrl}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="img-ring size-24 rounded-full object-cover md:size-28"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="display grid size-24 place-items-center rounded-full text-body-l md:size-28"
                      style={{
                        background: INITIAL_TONES[i % INITIAL_TONES.length],
                        color: 'var(--color-on-bright)',
                      }}
                    >
                      {initials(k.name)}
                    </span>
                  )}
                  <span className="display mt-4 block text-body-m text-text group-hover:text-anchor">
                    {k.name}
                  </span>
                  <span className="mt-1 block text-body-s text-muted2">{institutionLine(k)}</span>
                </Link>
              </Reveal>
            ))}
            {faculty.length === 0 && loadState === 'loading'
              ? Array.from({ length: 5 }, (_, i) => (
                  <li key={`kol-skeleton-${i}`} aria-hidden>
                    <span className="block size-24 rounded-full bg-surface-2 md:size-28" />
                    <span className="mt-4 block h-3 w-3/4 rounded-[6px] bg-surface-2" />
                    <span className="mt-2 block h-3 w-1/2 rounded-[6px] bg-surface-2" />
                  </li>
                ))
              : null}
          </ul>
        </Band>
      </>
    ),
  };
  /* A: no two horizontal scrollers touch.
     C: now + shows + articles fold into one tabbed block, so seven
        sections become five and only one scroller is loose on the page. */
  const ORDER =
    order === 'c'
      ? ['engine', 'latest', 'areas', 'moment', 'kol']
      : ['engine', 'now', 'moment', 'shows', 'articles', 'areas', 'kol'];

  return (
    <div className="min-w-0 overflow-x-hidden bg-ground text-text">

      {/* ── Hero ─────────────────────────────────────────── */}
      <HomeHero variant="demo" tiles={featuredVideos.map((v) => ({ id: v.id, imageUrl: v.imageUrl }))} />

      {/* ── The model, as a bento ─────────────────────────
          No headline. Five cards that each show a format rather than
          describe one — a heading above them would only say in words
          what the cards already say in full. */}
      {ORDER.map((key) => (
        <Fragment key={key}>{SECTIONS[key]}</Fragment>
      ))}

      {/* ── Get started ──────────────────────────────────── */}
      <section aria-labelledby="start-heading">
        <div className="rail flex flex-col items-center py-16 md:py-20 text-center">
          <h2 id="start-heading" className="display max-w-[18ch] text-display-l text-text">
            Free for clinicians. Always.
          </h2>
          <p className="prose-lede mt-5 max-w-[46ch] text-body-l text-muted2">
            Create an account to save your place, claim credit and get one email a week.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Btn to="/join" variant="cta" withArrow>
              Start watching free
            </Btn>
            <Btn to="/for-hcps" variant="outline">
              For HCPs
            </Btn>
          </div>
        </div>
      </section>
    </div>
  );
}
