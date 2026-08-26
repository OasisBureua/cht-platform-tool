import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../../api/webinars';
import { catalogApi, type CatalogItem } from '../../api/catalog';
import { isSessionExpired } from '../../utils/live-session-timing';
import { Button, Card, Chip, chipKind, Rail, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

const FALLBACK_WEBINAR_IMAGE = '/images/resource-webinars.png';

const STOCK_IMAGES = {
  featuredVideo: '/images/resource-watch.png',
  featuredWebinar: '/images/resource-webinars.png',
} as const;

/** Matches `--page-gutter`, so a `bleed-x` rail lands flush on the viewport edge. */
const RAIL = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';

/** Four cards across at the widest, with the fifth peeking past the edge. */
const RAIL_ITEM = 'w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[23.5%]';

/** A scrim has to stay dark whatever the appearance, so it is fixed rather than tokenised. */
const SCRIM = 'linear-gradient(to top, rgb(0 0 0 / 0.82) 0%, rgb(0 0 0 / 0.34) 46%, rgb(0 0 0 / 0.05) 100%)';

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
  slug: string;
  videoNames: string[];
  playlistUrl: string;
};

function catalogToTreatment(p: CatalogItem): Treatment {
  return {
    id: p.id,
    title: p.title,
    imageUrl: p.thumbnailUrl || '/images/placeholder-playlist.svg',
    slug: p.id,
    videoNames: p.videoNames || [],
    playlistUrl: `/catalog/playlist/${p.id}`,
  };
}

/**
 * Both feeds behind this page are merges: webinars come from DB programs
 * plus live Zoom sessions, playlists from the catalog and its WordPress
 * overlay. Either can carry the same id twice, which React reports as a
 * duplicate key and then renders unpredictably. Keep the first of each.
 */
function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

const FALLBACK_HR: Treatment[] = [
  { id: 'hr1', title: 'HR+ Big Picture & Practice Change', slug: 'hr-big-picture', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr2', title: 'First-Line & Sequencing Decisions', slug: 'hr-first-line-sequencing', imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr3', title: 'High-Risk & CNS Disease', slug: 'hr-high-risk-cns', imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
];

function isExpired(w: WebinarItem): boolean {
  if (!w.startTime) return false;
  return isSessionExpired(w.startTime, w.duration);
}

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function ForHCPs() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const hrPlusPlaylists = useMemo<Treatment[]>(() => {
    const rows = uniqueById(playlists);
    if (rows.length === 0) return FALLBACK_HR;
    const hrOrTnbc = rows.filter(
      (p) => /HR\+|hormone|TNBC|mTNBC|CDK4|endocrine|triple.?negative/i.test(p.title) &&
        !/HER2|her2|DESTINY-Breast/i.test(p.title)
    );
    if (hrOrTnbc.length > 0) return hrOrTnbc.map(catalogToTreatment);
    const nonHer2 = rows.filter(
      (p) => !/HER2|her2|DESTINY-Breast|HER2\+|HER2 Low|HER2 Positive/i.test(p.title)
    );
    return nonHer2.length > 0 ? nonHer2.map(catalogToTreatment) : FALLBACK_HR;
  }, [playlists]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sorted = uniqueById(webinars).sort((a, b) => {
      if (!a.startTime && !b.startTime) return 0;
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });
    return {
      upcoming: sorted.filter((w) => !isExpired(w)),
      past: sorted.filter((w) => {
        if (!isExpired(w) || !w.startTime) return false;
        return new Date(w.startTime).getTime() >= thirtyDaysAgo;
      }),
    };
  }, [webinars]);

  const firstWebinar = upcoming[0] ?? past[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Masthead + featured ─────────────────────────────
          The three destinations are the page's opening statement, so
          they sit inside the title band rather than under a heading of
          their own. */}
      <section>
        <div className={cn(RAIL, 'pt-14 pb-16 md:pt-20 md:pb-24')}>
          <Reveal>
            <h1 className="max-w-[14ch] text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem]">
              HCP Platform
            </h1>
          </Reveal>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
            <Reveal delay={60} className="h-full">
              <FeaturedCard
                title="Clinical Conversations"
                imageUrl={STOCK_IMAGES.featuredVideo}
                cta="Conversations"
                to="/catalog"
                showNew
              />
            </Reveal>
            <Reveal delay={120} className="h-full">
              <FeaturedCard
                title={firstWebinar?.title || 'Featured Webinar'}
                imageUrl={firstWebinar?.imageUrl || STOCK_IMAGES.featuredWebinar}
                cta="Join Now"
                to={firstWebinar ? `/webinars/${firstWebinar.id}` : '/webinars'}
                showNew
              />
            </Reveal>
            <Reveal delay={180} className="h-full">
              <FeaturedCard
                title="CHM Office Hours"
                imageUrl={STOCK_IMAGES.featuredWebinar}
                cta="View sessions"
                to="/chm-office-hours"
                showNew
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Featured Biomarker Playlists ─────────────────── */}
      <Band>
        <Reveal>
          <SectionHead
            index="01 / Playlists"
            title="Featured Biomarker Playlists"
            action={<Chip kind={chipKind('HR+')}>HR+</Chip>}
          />
        </Reveal>

        {playlistsLoading && playlists.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-12 grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hrPlusPlaylists.slice(0, 3).map((card, i) => (
              <Reveal key={card.id} delay={i * 60} className="h-full">
                <BiomarkerPlaylistCard card={card} />
              </Reveal>
            ))}
          </div>
        )}
      </Band>

      {/* ── Webinars ─────────────────────────────────────── */}
      <Band>
        <Reveal>
          <SectionHead index="02 / Sessions" title="Webinars" />
        </Reveal>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : webinars.length === 0 ? (
          <Reveal className="mt-12">
            <Card className="px-8 py-16 text-center">
              <p className="text-xl font-semibold tracking-tight text-foreground">No webinars scheduled</p>
              <p className="mx-auto mt-2 max-w-[42ch] text-muted-foreground">
                Check back soon for upcoming sessions.
              </p>
            </Card>
          </Reveal>
        ) : (
          <div className="mt-12 space-y-14">
            {upcoming.length > 0 && (
              /* The rail reveals as one block: a card scrolled off to the
                 right would otherwise never intersect the viewport and
                 stay blank until it was swiped in. */
              <Reveal>
                <GroupLabel>Upcoming · {upcoming.length}</GroupLabel>
                <Rail aria-label={`Upcoming webinars, ${upcoming.length}`}>
                  {upcoming.map((w) => (
                    <li key={w.id} className={RAIL_ITEM}>
                      <WebinarCard webinar={w} expired={false} />
                    </li>
                  ))}
                </Rail>
              </Reveal>
            )}

            {past.length > 0 && (
              <Reveal>
                <GroupLabel>Past · {past.length}</GroupLabel>
                <Rail aria-label={`Past webinars, ${past.length}`}>
                  {past.map((w) => (
                    <li key={w.id} className={RAIL_ITEM}>
                      <WebinarCard webinar={w} expired />
                    </li>
                  ))}
                </Rail>
              </Reveal>
            )}
          </div>
        )}
      </Band>
    </div>
  );
}

/* =======================
   UI Components
   ======================= */

/**
 * One content section. Space separates sections here, never a rule:
 * generous vertical air inside a rail that carries the page gutter.
 */
function Band({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section>
      <div className={cn(RAIL, 'py-16 md:py-24', className)}>{children}</div>
    </section>
  );
}

/** The mono eyebrow that names a group inside a section. */
function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 font-mono text-label uppercase tabular-nums text-muted-foreground">{children}</p>
  );
}

/**
 * Scroll-triggered entry, on the shared `rise-in` vocabulary: opacity
 * plus a 2px lift, nothing more, with the stagger carried as an
 * animation delay.
 *
 * Anything already on screen, or already scrolled past, is shown without
 * waiting for a callback, and a scroll/resize check backs the observer
 * up: a threshold that never gets crossed cleanly would otherwise strand
 * a block at opacity 0, and invisible content is a far worse failure
 * than an unanimated one. Under reduced motion the block starts shown
 * and the stylesheet neutralises the animation.
 */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: no-preference)').matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    const settled = () => el.getBoundingClientRect().top < window.innerHeight * 0.92;

    if (!('IntersectionObserver' in window) || settled()) {
      // The rAF lets the hidden state paint once so the entry still runs.
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    io.observe(el);

    const check = () => {
      if (!settled()) return;
      setShown(true);
      io.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={cn(shown ? 'rise-in' : 'opacity-0', className)}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function FeaturedCard({
  title,
  imageUrl,
  cta,
  to,
  showNew,
}: {
  title: string;
  imageUrl: string;
  cta: string;
  to: string;
  showNew?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex h-full min-h-[15rem] flex-col justify-end overflow-hidden rounded-card bg-muted shadow-card md:min-h-[18rem]',
        'transition-[box-shadow,translate,scale] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)]',
        'hover:-translate-y-0.5 hover:shadow-card-hover motion-safe:active:scale-[0.96]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <img
        src={imageUrl}
        alt=""
        loading="eager"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:scale-[1.03]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: SCRIM }} />

      {showNew && (
        <Chip kind="agent" className="absolute left-3 top-3 z-10">
          New
        </Chip>
      )}

      {/* Permanently dark region: the labels are fixed white, because the
          page-following tokens would resolve to dark grey on the scrim. */}
      <div className="relative flex flex-col items-start p-5 md:p-6">
        <p className="line-clamp-2 text-balance text-lg font-semibold leading-snug tracking-tight text-white md:text-xl">
          {title}
        </p>
        <span className="mt-4 inline-flex h-10 items-center gap-2 rounded-[6px] bg-card px-4 text-sm font-semibold text-foreground shadow-card transition-colors duration-150 group-hover:bg-background">
          {cta}
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </Link>
  );
}

function BiomarkerPlaylistCard({ card }: { card: Treatment }) {
  const names = card.videoNames.length > 0 ? card.videoNames : ['Video', 'Video', 'Video', 'Video'];
  return (
    <Card className="flex h-full min-h-[22rem] flex-col overflow-hidden p-0">
      <div className="relative aspect-video shrink-0 bg-muted">
        <img
          src={card.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
          {card.title}
        </h3>
        {/* The old bullet was a raw grey dot; a mono index carries the
            same "this is a list" signal and reads as data. */}
        <ul className="mt-4 space-y-2">
          {names.slice(0, 4).map((name, i) => (
            <li key={`${card.id}-${i}`} className="flex min-w-0 items-baseline gap-3 text-sm text-muted-foreground">
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/70">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="truncate" title={name}>
                {name}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-6">
          <Button to={card.playlistUrl} size="sm">
            Play all
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WebinarCard({ webinar: w, expired }: { webinar: WebinarItem; expired: boolean }) {
  const date = w.startTime ? new Date(w.startTime) : null;
  const imgSrc = w.imageUrl || FALLBACK_WEBINAR_IMAGE;

  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      <div className="relative aspect-video shrink-0 bg-muted">
        <img src={imgSrc} alt="" className="h-full w-full object-cover" loading="eager" />
        <Chip kind={expired ? 'neutral' : 'agent'} className="absolute left-3 top-3">
          {expired ? 'Expired' : 'Upcoming'}
        </Chip>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3
          className={cn(
            'line-clamp-2 text-base font-semibold leading-snug tracking-tight',
            expired ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {w.title}
        </h3>

        {date && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              {format(date, 'EEE, MMM d, yyyy')}
              {!expired && <span className="ml-1">· {formatDistanceToNow(date, { addSuffix: true })}</span>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              {format(date, 'h:mm a')}
            </span>
            {w.duration && <span>{formatDuration(w.duration)}</span>}
          </div>
        )}

        {w.description && (
          <p className="mt-3 line-clamp-2 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
            {w.description}
          </p>
        )}

        <div className="mt-auto pt-6">
          <Button to={`/webinars/${w.id}`} size="sm" variant={expired ? 'outline' : 'solid'}>
            Learn More
          </Button>
        </div>
      </div>
    </Card>
  );
}
