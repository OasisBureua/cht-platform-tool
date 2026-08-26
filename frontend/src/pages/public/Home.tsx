import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Search,
  Monitor,
  Headphones,
  FileText,
  Video,
  Clock,
  CalendarClock,
  LayoutGrid,
} from 'lucide-react';
import { catalogApi } from '../../api/catalog';
import { getShortClipId, extractYoutubeVideoIdFromUrl } from '../../utils/clipUrl';
import { StripCard, StripRowLoadingThumbnails } from '../../components/home/ConversationRow';
import { HomeHero } from '../../components/home/HomeHero';
import {
  ANON_HOME_BIOMARKER_CAROUSEL_IDS,
  BiomarkerConversationRow,
} from '../../components/content/BiomarkerConversationRow';
import DISEASE_AREAS from '../../data/disease-areas';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import { Button, Card, Chip, Rail, SectionHead } from '../../components/ui';

const resourceImages: Record<string, string> = {
  webinars: '/images/resource-webinars.png',
  protocols: '/images/resource-protocols.png',
  clinicals: '/images/resource-clinicals.png',
  watch: '/images/resource-watch.png',
  reporting: '/images/resource-reporting.png',
  data: '/images/resource-data.png',
  search: '/images/resource-search.png',
};

type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
  youtubeUrl?: string;
};

type Resource = {
  id: string;
  title: string;
  href: string;
  icon: ReactNode;
  imageUrl: string;
};

/** Shown when `/catalog/random-videos` returns [] so the carousel is never blank */
const FALLBACK_FEATURED: FeaturedVideo[] = [
  {
    id: 'home-placeholder-1',
    title: 'Browse clinical conversations in the library',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-2',
    title: 'Expert-led education across therapeutic areas',
    imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
  {
    id: 'home-placeholder-3',
    title: 'Webinars, protocols, and patient resources',
    imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=800&q=80',
    youtubeUrl: undefined,
  },
];

/** Staggered landing animation delays (ms) - paired with `.home-enter` in `index.css` */
const HOME_STAGGER_MS = {
  heroTitle: 0,
  heroLead: 90,
  heroCtas: 180,
  featHeading: 260,
  featCarousel: 340,
  disease: 420,
  biomarkerHead: 500,
  biomarkerBody: 580,
  hrHead: 680,
  hrBody: 760,
  about: 840,
  whoWe: 920,
  resourcesHead: 1000,
  resourcesGrid: 1080,
  faqHead: 1160,
  faqBody: 1240,
  closingHead: 1320,
  closingCta: 1400,
} as const;

/**
 * One content section. Space separates the bands, never a rule: the
 * generous `py` is the divider, and the inner rail carries the page
 * gutter that `bleed-x` rails cancel back out.
 */
function Band({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">{children}</div>
    </section>
  );
}

/** The one "see all" affordance a band is allowed, on the head's baseline. */
function SeeAll({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Button to={to} variant="outline" size="sm">
      {children}
      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
    </Button>
  );
}

/** How We Help Pharma - copy lives in one place so the accordion is one loop. */
const PHARMA_FAQ: { title: string; body: string }[] = [
  {
    title: 'AI-Powered Content Automation',
    body: 'Turn one medical webinar or clinical presentation into 20+ platform-specific assets: social posts, podcast clips, infographics, and more.',
  },
  {
    title: 'Multi-Audience Reach',
    body: 'Engage KOLs, HCPs, patients, and caregivers through one connected content system.',
  },
  {
    title: 'Entertainment-Grade Distribution',
    body: 'Use podcasts, social media, live events, and owned digital properties to reach audiences where they consume trusted information.',
  },
  {
    title: 'First-Party HCP Intelligence',
    body: 'Access proprietary data for precision targeting, lookalike audiences, and measurable activation.',
  },
  {
    title: 'Real Engagement Analytics',
    body: 'Move beyond impressions. Track who watched, who shared, and who acted on it.',
  },
];

const WHO_WE_REACH: { audience: string; body: string }[] = [
  { audience: 'HCPs', body: 'Beyond conferences and CME, where they actually consume content' },
  { audience: 'Patients', body: 'Pre or active treatment, searching for credible information' },
  { audience: 'Caregivers', body: 'Making decisions, seeking guidance, needing support' },
];

export default function Home() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const { data: randomVideosData, isLoading: randomVideosLoading } = useQuery({
    queryKey: ['catalog', 'random-videos'],
    queryFn: () => catalogApi.getRandomVideos(6),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
  });
  const randomVideos = Array.isArray(randomVideosData) ? randomVideosData : [];

  const [brokenFeaturedIds, setBrokenFeaturedIds] = useState<Set<string>>(
    () => new Set(),
  );

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
    // Placeholders are static Unsplash assets — only use when API returned nothing.
    if (brokenFeaturedIds.size > 0) return [];
    return randomVideosLoading ? [] : FALLBACK_FEATURED;
  }, [randomVideos, randomVideosLoading, brokenFeaturedIds]);

  const resources: Resource[] = [
    { id: 'r1', title: 'Webinars', href: '/webinars', icon: <Monitor className="h-10 w-10" />, imageUrl: resourceImages.webinars },
    {
      id: 'office-hours',
      title: 'CHM Office Hours',
      href: '/chm-office-hours',
      icon: <CalendarClock className="h-10 w-10" />,
      imageUrl: resourceImages.webinars,
    },
    { id: 'r2', title: 'Protocols', href: '/catalog', icon: <Headphones className="h-10 w-10" />, imageUrl: resourceImages.protocols },
    { id: 'r3', title: 'Clinicals', href: '/catalog', icon: <FileText className="h-10 w-10" />, imageUrl: resourceImages.clinicals },
    { id: 'r4', title: 'Conversations', href: '/catalog', icon: <Video className="h-10 w-10" />, imageUrl: resourceImages.watch },
    { id: 'r5', title: 'Reporting', href: '/catalog', icon: <Clock className="h-10 w-10" />, imageUrl: resourceImages.reporting },
    { id: 'r6', title: 'Data', href: '/catalog', icon: <LayoutGrid className="h-10 w-10" />, imageUrl: resourceImages.data },
    { id: 'r7', title: 'Library', href: '/catalog', icon: <Search className="h-10 w-10" />, imageUrl: resourceImages.search },
  ];

  return (
    <div className="min-w-0 overflow-x-hidden bg-background text-foreground">
      <HomeHero tiles={featuredVideos.map((v) => ({ id: v.id, imageUrl: v.imageUrl }))} />

      {/* 01 - Featured: a bleed rail, so the last card runs off the edge
          rather than being clipped inside the gutter. */}
      <Band>
        {randomVideosLoading && (
          <>
            <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.featHeading}ms` }}>
              <SectionHead
                index="01 / Featured"
                title="Featured videos"
                action={<SeeAll to="/catalog?view=clips">See all in library</SeeAll>}
              />
            </div>
            <div
              className="home-enter mt-10"
              style={{ animationDelay: `${HOME_STAGGER_MS.featCarousel}ms` }}
            >
              <Rail aria-label="Featured videos">
                {/* `contents` keeps the <ul>/<li> contract while the six
                    skeleton tiles stay direct flex items of the rail. */}
                <li className="contents" aria-hidden>
                  <StripRowLoadingThumbnails />
                </li>
              </Rail>
            </div>
          </>
        )}

        {!randomVideosLoading && featuredVideos.length > 0 && (
          <>
            <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.featHeading}ms` }}>
              <SectionHead
                index="01 / Featured"
                title="Featured videos"
                action={
                  <div className="flex items-center gap-3">
                    <Chip>{featuredVideos.length} items</Chip>
                    <SeeAll to="/catalog?view=clips">See all in library</SeeAll>
                  </div>
                }
              />
            </div>
            <div
              className="home-enter mt-10"
              style={{ animationDelay: `${HOME_STAGGER_MS.featCarousel}ms` }}
            >
              <Rail aria-label="Featured videos">
                {featuredVideos.map((v) => (
                  <li key={v.id} className="shrink-0 snap-start">
                    <StripCard
                      to={v.id.startsWith('home-placeholder') ? '/catalog?view=clips' : `/catalog/clip/${getShortClipId(v.id)}`}
                      title={v.title}
                      imageUrl={v.imageUrl}
                      variant="thumbnailOnly"
                      meta={v.youtubeUrl ? 'YouTube' : 'Conversation'}
                      hideThumbnailOnError={!v.id.startsWith('home-placeholder')}
                      onThumbnailError={() =>
                        setBrokenFeaturedIds((prev) => {
                          if (prev.has(v.id)) return prev;
                          const next = new Set(prev);
                          next.add(v.id);
                          return next;
                        })
                      }
                    />
                  </li>
                ))}
              </Rail>
            </div>
          </>
        )}
      </Band>

      {/* 02 - Biomarker strips: catalog clips by tag (HER2+ / HR+), not YouTube playlists */}
      <Band>
        <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.biomarkerHead}ms` }}>
          <SectionHead index="02 / Biomarkers" title="Conversations by biomarker" />
        </div>
        <div className="mt-10 space-y-12">
          {ANON_HOME_BIOMARKER_CAROUSEL_IDS.map((carouselId, index) => (
            <div
              key={carouselId}
              className="home-enter"
              style={{
                animationDelay: `${
                  carouselId === 'anon-home-hr'
                    ? HOME_STAGGER_MS.hrBody
                    : HOME_STAGGER_MS.biomarkerBody + index * 40
                }ms`,
              }}
            >
              <BiomarkerConversationRow carouselId={carouselId} isInApp={false} />
            </div>
          ))}
        </div>
      </Band>

      <DiseaseAreasCarousel staggerBaseMs={HOME_STAGGER_MS.disease} />

      {/* 04 - About Us teaser */}
      <Band>
        <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.about}ms` }}>
          <SectionHead
            index="04 / About"
            title="About Us"
            action={<Button to="/about">Learn More</Button>}
          />
          <div className="mt-8 max-w-[54ch] space-y-5 text-pretty text-lg leading-relaxed text-muted-foreground">
            <p>
              Community Health Media (CHM) is a full-service medical communications partner: expert-led content,
              strategic distribution, and multichannel campaigns for healthcare. We help organizations connect with HCPs,
              KOLs, and patient communities through clinically credible communication.
            </p>
            <p>
              Learn more about what we stand for, who we serve, and how our platform supports clinical learning.
            </p>
          </div>
        </div>
      </Band>

      {/* 05 - Who We Reach */}
      <Band>
        <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.whoWe}ms` }}>
          <SectionHead index="05 / Audience" title="Who We Reach" />
        </div>
        <div
          className="home-enter mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3"
          style={{ animationDelay: `${HOME_STAGGER_MS.whoWe + 90}ms` }}
        >
          {WHO_WE_REACH.map((w) => (
            <Card key={w.audience}>
              <p className="text-lg font-semibold text-foreground">{w.audience}</p>
              <p className="mt-2 max-w-[36ch] text-pretty leading-relaxed text-muted-foreground">{w.body}</p>
            </Card>
          ))}
        </div>
      </Band>

      {/* 06 - Resources */}
      <Band>
        <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.resourcesHead}ms` }}>
          <SectionHead index="06 / Resources" title="Resources" />
        </div>
        <div
          className="home-enter mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4"
          style={{ animationDelay: `${HOME_STAGGER_MS.resourcesGrid}ms` }}
        >
          {resources.map((r) => (
            <Link
              key={r.id}
              to={r.href}
              className="group relative block min-h-[150px] overflow-hidden rounded-card bg-muted shadow-card transition-[box-shadow,translate,scale] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96] md:min-h-[176px]"
            >
              <img
                src={r.imageUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover transition-[scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]"
              />
              {/* The tile is a permanently dark region, so its label is
                  fixed white rather than a page-following token. */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20 transition-[opacity] duration-150 group-hover:opacity-90" />
              <div className="relative flex min-h-[150px] flex-col justify-between p-4 md:min-h-[176px]">
                <span className="text-white/90 transition-[color] duration-150 group-hover:text-white">{r.icon}</span>
                <p className="text-balance text-sm font-semibold text-white">{r.title}</p>
              </div>
            </Link>
          ))}
        </div>
      </Band>

      {/* 07 - How We Help Pharma: each answer is a surface, not a ruled row */}
      <Band>
        <div className="home-enter" style={{ animationDelay: `${HOME_STAGGER_MS.faqHead}ms` }}>
          <SectionHead index="07 / Capabilities" title="How We Help Pharma Educate Healthcare Audiences" />
        </div>
        <div
          className="home-enter mt-10 space-y-3"
          style={{ animationDelay: `${HOME_STAGGER_MS.faqBody}ms` }}
        >
          {PHARMA_FAQ.map((item) => (
            <details
              key={item.title}
              className="home-faq-item group rounded-card bg-card shadow-card transition-[box-shadow] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:shadow-card-hover"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
                <span className="flex min-w-0 items-start gap-3">
                  <span className="mt-1 shrink-0 text-success" aria-hidden>
                    ✓
                  </span>
                  <span className="text-balance text-xl font-medium leading-snug text-foreground md:text-[1.375rem]">
                    {item.title}
                  </span>
                </span>
                <span className="grid size-10 shrink-0 place-items-center rounded-[6px] bg-muted text-foreground transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:duration-0 motion-reduce:transition-none group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              {/* The answer hangs under the question, clear of the check. */}
              <p className="max-w-[62ch] text-pretty pb-6 pe-5 ps-[3.25rem] text-base leading-relaxed text-muted-foreground sm:pe-6 sm:ps-[3.75rem]">
                {item.body}
              </p>
            </details>
          ))}
        </div>
        <div
          className="home-enter mt-10 flex"
          style={{ animationDelay: `${HOME_STAGGER_MS.faqBody + 90}ms` }}
        >
          <Button to="/join" size="lg">
            Get Started
          </Button>
        </div>
      </Band>

      {/* Closing statement. A surface change closes the page; no rule above it. */}
      <section className="bg-card">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 md:py-28 lg:px-8">
          <h2
            className="home-enter mx-auto max-w-[20ch] text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[3rem] md:text-[3.5rem]"
            style={{ animationDelay: `${HOME_STAGGER_MS.closingHead}ms` }}
          >
            A Media Company That&apos;s About More Than Just Content
          </h2>
          <div
            className="home-enter mt-10 flex justify-center"
            style={{ animationDelay: `${HOME_STAGGER_MS.closingCta}ms` }}
          >
            <Button to="/join" size="lg" className="min-w-[13rem]">
              Join Us
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

type DiseaseAreasCarouselProps = {
  /** Base delay (ms) for landing stagger; sub-regions add ~80–90ms each */
  staggerBaseMs?: number;
};

function DiseaseAreasCarousel({ staggerBaseMs = 0 }: DiseaseAreasCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const mid = Math.floor(DISEASE_AREAS.length / 2);
    const card = el.querySelectorAll('[data-disease-card]')[mid] as HTMLElement | undefined;
    if (card) {
      // Scroll only the horizontal strip: never use scrollIntoView (it can jump the page).
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      el.scrollLeft = Math.max(0, cardCenter - el.clientWidth / 2);
    }
    setActiveIdx(mid);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('[data-disease-card]');
    const containerCenter = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const rect = (card as HTMLElement).getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const cardCenter = rect.left - elRect.left + el.scrollLeft + rect.width / 2;
      const dist = Math.abs(containerCenter - cardCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    setActiveIdx(closest);
  }, []);

  const scrollTo = useCallback((idx: number) => {
    setActiveIdx(idx);
    const el = scrollRef.current;
    const card = el?.querySelectorAll('[data-disease-card]')[idx] as HTMLElement | undefined;
    if (!el || !card) return;
    const cardCenter = card.offsetLeft + card.offsetWidth / 2;
    el.scrollTo({
      left: Math.max(0, cardCenter - el.clientWidth / 2),
      behavior: 'smooth',
    });
  }, []);

  return (
    <section className="py-16 md:py-24">
      {/* 03 - the head keeps the page rail; the strip runs full width. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="home-enter" style={{ animationDelay: `${staggerBaseMs}ms` }}>
          <SectionHead
            index="03 / Areas"
            title="View treatment specific content"
            sub="Explore content by therapeutic area - expert-led education, conversations, and resources."
          />
        </div>
      </div>

      <div
        className="home-enter mt-10 w-full min-w-0"
        style={{ animationDelay: `${staggerBaseMs + 180}ms` }}
      >
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex snap-x snap-mandatory gap-5 overflow-x-auto overflow-y-hidden scroll-smooth px-4 py-4 sm:px-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div
            className="w-[max(1rem,calc(50%-280px))] shrink-0 sm:w-[max(1rem,calc(50%-300px))] md:w-[max(1rem,calc(50%-340px))] lg:w-[max(1rem,calc(50%-360px))]"
            aria-hidden
          />
          {DISEASE_AREAS.map((area) => {
            const inner = (
              <div
                data-disease-card
                className="group relative h-[180px] w-[280px] shrink-0 snap-center overflow-hidden rounded-card shadow-card transition-[box-shadow,translate] duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-0.5 hover:shadow-card-hover sm:h-[260px] sm:w-[420px] md:h-[320px] md:w-[560px] lg:h-[340px] lg:w-[640px]"
              >
                <img
                  src={area.image}
                  alt={area.title}
                  className="absolute inset-0 h-full w-full object-cover transition-[scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-[1.03]"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                {/* Permanently dark region: the label is fixed white. */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-5 p-5 sm:p-8 md:p-10">
                  <h3 className="text-balance text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl md:text-[2.25rem] md:leading-[1.08] md:tracking-[-0.025em]">
                    {area.title}
                  </h3>
                  <span className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[6px] bg-white/15 px-4 text-sm font-medium text-white backdrop-blur-sm transition-[background-color] duration-150 group-hover:bg-white/25 sm:text-base">
                    Explore Treatment
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </span>
                </div>
              </div>
            );
            return area.active ? (
              <Link
                key={area.slug}
                to={`/catalog/${area.slug}`}
                className="shrink-0 snap-center rounded-card transition-[scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.96]"
              >
                {inner}
              </Link>
            ) : (
              <div key={area.slug} className="w-fit shrink-0 cursor-default snap-center">
                {inner}
              </div>
            );
          })}
          <div
            className="w-[max(1rem,calc(50%-280px))] shrink-0 sm:w-[max(1rem,calc(50%-300px))] md:w-[max(1rem,calc(50%-340px))] lg:w-[max(1rem,calc(50%-360px))]"
            aria-hidden
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl justify-center px-4 sm:px-6 lg:px-8">
        <div
          className="home-enter flex flex-wrap items-center justify-center gap-1"
          style={{ animationDelay: `${staggerBaseMs + 270}ms` }}
          role="tablist"
          aria-label="Disease area slides"
        >
          {DISEASE_AREAS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === activeIdx}
              onClick={() => scrollTo(idx)}
              className="group/dot flex h-9 items-center px-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`Go to disease area ${idx + 1}`}
            >
              <span
                className={[
                  'h-2 rounded-[6px] transition-[width,background-color] duration-300',
                  idx === activeIdx
                    ? 'w-8 bg-foreground'
                    : 'w-2 bg-muted-foreground/35 group-hover/dot:bg-muted-foreground/60',
                ].join(' ')}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
