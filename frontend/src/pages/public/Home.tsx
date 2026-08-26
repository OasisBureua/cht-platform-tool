import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog';
import { getShortClipId, extractYoutubeVideoIdFromUrl } from '../../utils/clipUrl';
import { HomeHero } from '../../components/home/HomeHero';
import { SessionWidget } from '../../components/home/SessionWidget';
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
}: {
  children: ReactNode;
  labelledBy?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby={labelledBy}>
      <div className={`rail py-16 md:py-24 ${className}`}>{children}</div>
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

export default function Home() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

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
        mix: AREA_TONES[a.slug]?.mix ?? 'var(--color-blue)',
        live: a.active,
        to: a.active ? `/catalog/${a.slug}` : undefined,
      })),
      ...DESIGN_ONLY_AREAS.map((a) => ({
        ...a,
        mix: 'var(--color-blue)',
        live: false,
        to: undefined,
      })),
    ],
    [],
  );

  const sessionPoster = featuredVideos[0]?.imageUrl ?? '/img/thumb-cleopatra.jpg';

  return (
    <div className="min-w-0 overflow-x-hidden bg-ground text-text">
      {/* ── Hero ─────────────────────────────────────────── */}
      <HomeHero variant="field" tiles={featuredVideos.map((v) => ({ id: v.id, imageUrl: v.imageUrl }))} />

      {/* ── Now on CHM ───────────────────────────────────── */}
      <Band labelledBy="now-heading">
        <SectionHead
          id="now-heading"
          index="01 / Latest"
          title="Now on CHM"
          sub="The most recent across every format."
          seeAll={{ noun: 'content', to: '/catalog' }}
        />
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
      </Band>

      {/* ── Showcase / content engine ────────────────────── */}
      <Band labelledBy="engine-heading">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>02 / The model</Eyebrow>
            <h2 id="engine-heading" className="display mt-5 text-display-l">
              <span className="block text-text">One recording.</span>
              <span className="block text-muted2">Three formats.</span>
            </h2>
            <p className="prose-lede mt-6 max-w-[44ch] text-body-l text-muted2">
              A single peer-to-peer conversation becomes a long-form interview, a podcast episode, a
              written explainer, each filed under the same disease state.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Btn to="/contact" variant="cta" withArrow>
                Partner with CHM
              </Btn>
              <Btn to="/catalog" variant="outline">
                Browse the library
              </Btn>
            </div>
          </Reveal>

          <Reveal delay={80}>
            {/* Window chrome, then the format row, then the sheet: the
                same stack a browser uses, so the front format reads as
                the document rather than a button above a box. */}
            <SessionWidget poster={sessionPoster} />
          </Reveal>
        </div>
      </Band>

      {/* ── Podcast network ──────────────────────────────── */}
      <Band labelledBy="shows-heading">
        <SectionHead
          id="shows-heading"
          index="03 / Podcasts"
          title="CHM Podcast Network"
          sub="Four shows, each with its own voice and its own audience."
          seeAll={{ noun: 'shows', to: '/chm-office-hours' }}
        />
        <div className="mt-12">
          {/* Headroom lives inside the scroller: overflow-x also clips
              vertically, which would cut off the hover lift. */}
          <div className="-my-5">
            <ul className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-4 overflow-x-auto py-5">
              {shows.map((s) => (
                <li key={s.slug} className="w-[19rem] shrink-0 snap-start">
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
                        className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/45 to-transparent"
                      />
                      <ChmMark className="absolute bottom-3 start-3 size-6 text-white/90" />
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
      </Band>

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

      {/* ── Editorial ────────────────────────────────────── */}
      <Band labelledBy="articles-heading">
        <SectionHead
          id="articles-heading"
          index="05 / Editorial"
          title="Recent articles"
          seeAll={{ noun: 'articles', to: '/catalog' }}
        />
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
      </Band>

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

      {/* ── Explore by disease state ─────────────────────── */}
      <Band labelledBy="areas-heading">
        <SectionHead
          id="areas-heading"
          index="07 / Browse"
          title="Explore by disease state"
          sub="Seven clinical areas on the map, each with its own colour through the library."
        />
        <div className="mt-12">
          {/* overflow-x-auto clips vertically too, so the hover lift needs
              headroom inside the scroller rather than margin outside it. */}
          <div className="-my-5">
            <div className="scrollbar-none bleed-x flex snap-x snap-mandatory gap-3 overflow-x-auto py-5">
              {areas.map((a) => {
                const inner = (
                  <>
                    {/* Metallic build-up: a lit top edge, a shaded floor and
                        a sheen that sweeps across on hover. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -z-10"
                      style={{
                        background:
                          'linear-gradient(180deg, rgb(255 255 255 / 0.3) 0%, rgb(255 255 255 / 0.08) 34%, rgb(0 0 0 / 0.05) 70%, rgb(0 0 0 / 0.14) 100%)',
                      }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px"
                      style={{ background: 'rgb(255 255 255 / 0.55)' }}
                    />
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 -z-10 w-1/2 -translate-x-[220%] skew-x-[-18deg] transition-transform duration-200 ease-[var(--ease-out-strong)] group-hover:translate-x-[320%] motion-reduce:hidden"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent, rgb(255 255 255 / 0.34), transparent)',
                      }}
                    />
                    <span>
                      <span className="display block text-display-s">{a.label}</span>
                      <span className="mt-0.5 block text-body-s text-on-bright/80">
                        {a.live ? 'Video, podcast, editorial' : 'Coming this quarter'}
                      </span>
                    </span>
                    <Arrow
                      className="size-4 transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1"
                      strokeWidth={2}
                    />
                  </>
                );
                const shell =
                  'group relative isolate flex min-w-[15rem] flex-1 snap-start items-center justify-between gap-6 overflow-hidden rounded-[6px] px-7 py-5 text-on-bright shadow-card transition-[translate,box-shadow] duration-200 ease-[var(--ease-out-strong)]';
                const tone = {
                  backgroundImage: `linear-gradient(135deg, ${a.tone} 0%, color-mix(in oklab, ${a.tone} 62%, ${a.mix}) 100%)`,
                };
                return a.to ? (
                  <Link
                    key={a.slug}
                    to={a.to}
                    style={tone}
                    className={`press ${shell} hover:-translate-y-1 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={a.slug} style={tone} className={`${shell} cursor-default`}>
                    {inner}
                  </div>
                );
              })}
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

      {/* ── Get started ──────────────────────────────────── */}
      <section aria-labelledby="start-heading">
        <div className="rail flex flex-col items-center py-24 text-center">
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
