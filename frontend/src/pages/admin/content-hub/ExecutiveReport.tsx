import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Pencil,
  Printer,
  Sparkles,
} from 'lucide-react';
import { LogoMark } from './components/Logo';
import { useToast } from './components/Toaster';
import { useExecutiveReport } from './lib/hooks';
import { cn } from './lib/utils';
import {
  CoverNodes,
  DecoPanel,
  FluidMark,
  PlatformTile,
  Slide,
  SlideHeaderBar,
  TouchRow,
} from './executive-report-parts';

const SLIDE_IDS = [
  'slide-cover',
  'slide-exec-summary',
  'slide-production',
  'slide-distribution',
  'slide-touchpoints',
  'slide-impact',
  'slide-platforms',
  'slide-targeting',
  'slide-learnings',
  'slide-conclusion',
  'slide-back',
];

// Chillax is already loaded by the platform, so no external @import here (keeps the deck
// self-contained). `color-scheme: dark` + hardcoded colors keep the deck's intrinsic look
// regardless of the platform theme.
const DECK_CSS = `
        .exec-slide, .exec-slide * { font-family: 'Chillax', system-ui, sans-serif !important; }
        @media print {
          @page { size: landscape; margin: 0; }
          .exec-deck-root { background: transparent !important; }
          .no-print { display: none !important; }
          .exec-slide { page-break-after: always !important; break-after: page !important; page-break-inside: avoid !important; min-height: 100vh !important; }
        }
      `;

const GHOST_BTN =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-transparent min-h-8 rounded-md';

const PLATFORM_DOT_COLORS: Record<string, string> = {
  linkedin: '#0077b5',
  meta: '#1877f2',
  youtube: '#ff0000',
  livestream: '#3da4c0',
  survey: '#2e7d32',
};

const TARGETING_CHIPS = ['Healthcare\nProfessionals', 'Caregivers', 'Patient\nCommunities'];

const TARGETING_BULLETS = [
  'Clinical job titles & specialties',
  'Hospital & academic affiliations',
  'Medical schools & professional associations',
  'Geo-targeting: cancer centers & research campuses',
];

function coverDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function ExecutiveReport() {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [active, setActive] = useState(0);

  const { data: report, isLoading, refetch } = useExecutiveReport(id);

  useEffect(() => {
    if (!report) return;
    const onScroll = () => {
      const probe = window.scrollY + window.innerHeight / 3;
      let idx = 0;
      SLIDE_IDS.forEach((sid, i) => {
        const el = document.getElementById(sid);
        if (el && el.offsetTop <= probe) idx = i;
      });
      setActive(idx);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [report]);

  const goTo = useCallback((i: number) => {
    const el = document.getElementById(SLIDE_IDS[Math.max(0, Math.min(SLIDE_IDS.length - 1, i))]);
    if (el) window.scrollTo({ top: el.offsetTop - 44, behavior: 'smooth' });
  }, []);

  if (isLoading || !report) {
    return (
      <div className="exec-deck-root flex min-h-screen items-center justify-center bg-[#1e2433] text-sm text-white/40" style={{ fontFamily: 'Chillax, sans-serif' }}>
        Loading executive report…
      </div>
    );
  }

  const { campaign, metrics, platformBreakdown, config } = report;
  const views = metrics.totalViewsFormatted ?? '-';
  const impressions = metrics.totalImpressionsFormatted ?? '-';
  const noMetrics = metrics.totalViews == null && metrics.totalImpressions == null;
  const episodeCount = Number(config.longFormEpisodes);

  return (
    <div className="exec-deck-root min-h-screen bg-[#1e2433]" style={{ fontFamily: 'Chillax, sans-serif', colorScheme: 'dark' }}>
      <style>{DECK_CSS}</style>

      {/* ---- Toolbar ---- */}
      <div className="no-print sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#1e2433] px-5 py-2.5 text-white shadow-xl">
        <div className="flex items-center gap-3">
          <Link to="/admin/content-hub">
            <button aria-label="Back to Content Hub" className="rounded p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Link>
          <div className="h-4 w-px bg-white/20" />
          <div className="h-5 w-5 flex-shrink-0 object-contain">
            <LogoMark size={20} />
          </div>
          <span className="max-w-xs truncate text-sm font-semibold text-white">{campaign.name}</span>
          <span className="hidden text-xs text-white/30 sm:block">, Executive Report</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="mr-3 hidden items-center gap-1 sm:flex">
            {SLIDE_IDS.map((sid, i) => (
              <button
                key={sid}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={cn('h-1.5 rounded-full transition-all', i === active ? 'w-4 bg-[#3da4c0]' : 'w-1.5 bg-white/20 hover:bg-white/40')}
              />
            ))}
          </div>
          <button onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous slide" className={`${GHOST_BTN} h-7 px-2 text-xs text-white/40 hover:bg-white/10 hover:text-white`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-12 text-center text-xs text-white/30">{active + 1}/{SLIDE_IDS.length}</span>
          <button onClick={() => goTo(active + 1)} disabled={active === SLIDE_IDS.length - 1} aria-label="Next slide" className={`${GHOST_BTN} h-7 px-2 text-xs text-white/40 hover:bg-white/10 hover:text-white`}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="mx-1 h-4 w-px bg-white/20" />
          <button onClick={() => refetch()} className={`${GHOST_BTN} h-7 px-3 text-xs text-[#ff9e40]/70 hover:bg-white/10 hover:text-[#ff9e40]`}>
            <Sparkles className="mr-1 h-3 w-3" />
            AI Draft
          </button>
          <button
            onClick={() => toast({ title: 'Edit Deck', description: 'Deck editing is not available in this preview.' })}
            className={`${GHOST_BTN} h-7 px-3 text-xs text-white/50 hover:bg-white/10 hover:text-white`}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit Deck
          </button>
          <button
            onClick={() => toast({ title: 'Template', description: 'Template switching is not available in this preview.' })}
            className={`${GHOST_BTN} h-7 px-3 text-xs text-white/40 hover:bg-white/10 hover:text-white`}
          >
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Template
          </button>
          <button
            onClick={() => window.print()}
            className="ml-1 inline-flex h-7 min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-[#e7764f] px-3 text-xs font-medium text-white transition-colors hover:bg-[#c0603c] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
          >
            <Printer className="mr-1 h-3 w-3" />
            Export
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {/* ---- 1. Cover ---- */}
        <Slide id="slide-cover" dark extra="bg-[#1a2236]">
          <div className="pointer-events-none absolute top-0 right-0 flex h-full select-none items-center" style={{ width: '46%' }}>
            <CoverNodes />
          </div>
          <div className="pointer-events-none absolute bottom-16 left-16 right-16 h-px bg-white/10" />
          <div className="relative z-10 flex h-full flex-1 flex-col justify-between" style={{ padding: '3rem 4rem' }}>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 object-contain">
                <LogoMark size={32} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.32em', textTransform: 'uppercase', fontFamily: 'Chillax, sans-serif' }}>
                Community Health Media
              </span>
            </div>
            <div style={{ maxWidth: '54%' }}>
              <div className="mb-7 inline-flex items-center rounded-full border border-white/25 px-4 py-1.5">
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.6)' }}>Campaign Performance Report</span>
              </div>
              <h1 className="mb-5 font-black leading-[1.05] text-white" style={{ fontSize: 'clamp(2.55rem, 5.5vw, 4.9rem)' }}>{campaign.name}</h1>
              <div className="font-semibold text-[#e7764f]" style={{ fontSize: 'clamp(1.15rem, 2.3vw, 1.6rem)' }}>Prepared for {campaign.clientSponsor}</div>
            </div>
            <div className="flex items-end justify-between">
              <div className="text-sm leading-relaxed text-white/35">
                <span>{campaign.diseaseState}</span>
                <span className="ml-2 text-white/20">, {campaign.treatmentTopic}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-white/55">{coverDate(campaign.reportingPeriodEnd || campaign.createdAt)}</div>
                <div className="mt-1 text-sm text-white/15">communityhealth.media</div>
              </div>
            </div>
          </div>
        </Slide>

        {/* ---- 2. Executive Summary ---- */}
        <Slide id="slide-exec-summary">
          <div className="flex flex-1" style={{ minHeight: 'inherit' }}>
            <div className="flex flex-1 flex-col border-r border-[#f2f4f8] px-14 py-10">
              <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-[#3da4c0]">Executive Summary</div>
              <h2 className="mb-2 text-5xl font-black leading-tight text-[#485165]">Content Campaign Executive Report</h2>
              <p className="mb-6 text-2xl font-light italic text-[#79869a]">{campaign.programName}</p>
              <div className="mb-3 mt-3 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#79869a]">Overview</h3>
              </div>
              <p className="text-lg leading-relaxed text-[#485165]">{config.overviewText}</p>
            </div>
            <DecoPanel className="w-72 flex-shrink-0" style={{ backgroundColor: 'rgb(72, 81, 101)' }}>
              <div className="flex h-full flex-col items-center justify-center gap-8 px-9 py-10">
                <div className="text-center">
                  <div className="text-6xl font-black leading-none text-[#3da4c0]">{views}</div>
                  <div className="mt-3 text-sm font-semibold uppercase tracking-widest text-white">Total Views</div>
                  <div className="mt-1 text-sm text-white/35">Across all platforms</div>
                </div>
                <div className="h-px w-8 bg-white/15" />
                <div className="text-center">
                  <div className="text-6xl font-black leading-none text-[#ff9e40]">{impressions}</div>
                  <div className="mt-3 text-sm font-semibold uppercase tracking-widest text-white">Total Impressions</div>
                  <div className="mt-1 text-sm text-white/35">Owned + paid-supported</div>
                </div>
              </div>
            </DecoPanel>
          </div>
        </Slide>

        {/* ---- 3. Production Strategy ---- */}
        <Slide id="slide-production">
          <SlideHeaderBar kicker="Content Overview" title="Production Strategy" />
          <div className="flex flex-1 gap-12 px-14 py-8">
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#79869a]">Overview</h3>
              </div>
              <p className="text-lg leading-relaxed text-[#485165]">{config.productionOverview}</p>
            </div>
            <div className="w-72 flex-shrink-0 space-y-4">
              <DecoPanel className="h-28 flex-shrink-0 items-end rounded-xl p-5" style={{ backgroundColor: 'rgb(61, 164, 192)' }} markColor="#ffffff">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Content Production</div>
                  <div className="mt-0.5 text-base font-black text-white">Community Health Media</div>
                </div>
              </DecoPanel>
              <div className="rounded-xl border-l-4 border-[#3da4c0] bg-[#f2f4f8] p-6">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#3da4c0]">Long-Form</div>
                <div className="text-4xl font-black text-[#485165]">{config.longFormEpisodes} Episode{episodeCount === 1 ? '' : 's'}</div>
                <div className="mt-2 text-base text-[#79869a]">Expert conversation, professionally produced</div>
              </div>
              <div className="rounded-xl border-l-4 border-[#e7764f] bg-[#f2f4f8] p-6">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#e7764f]">Live Stream</div>
                <div className="text-4xl font-black text-[#485165]">Live Event</div>
                <div className="mt-2 text-base text-[#79869a]">Virtual scientific exchange</div>
              </div>
            </div>
          </div>
        </Slide>

        {/* ---- 4. Distribution Strategy ---- */}
        <Slide id="slide-distribution">
          <SlideHeaderBar kicker="Content Overview" title="Distribution Strategy" />
          <div className="flex flex-1 gap-12 px-14 py-8">
            <div className="flex-1">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#79869a]">Overview</h3>
              </div>
              <p className="mb-6 text-lg leading-relaxed text-[#485165]">{config.distributionOverview}</p>
              <h3 className="mb-3 mt-5 text-sm font-bold uppercase tracking-widest text-[#79869a]">Short-Form Content Areas</h3>
              {config.contentThemes.length === 0 ? (
                <p className="text-lg italic text-[#79869a]">Click "Edit Deck" to add clinical content themes.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {config.contentThemes.map((theme) => (
                    <div key={theme} className="flex items-start gap-3 text-lg text-[#485165]">
                      <div className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#e7764f]" />
                      {theme}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="w-60 flex-shrink-0">
              <DecoPanel className="mb-5 h-36 flex-shrink-0 items-end rounded-xl p-5" style={{ backgroundColor: 'rgb(72, 81, 101)' }}>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#3da4c0]">Distribution</div>
                  <div className="mt-0.5 text-base font-black text-white">Multi-Channel Strategy</div>
                </div>
              </DecoPanel>
              <div className="mb-3 text-sm font-bold uppercase tracking-widest text-[#79869a]">Platforms</div>
              <div className="space-y-2">
                {campaign.platforms.map((p) => (
                  <div key={p} className="flex items-center gap-3 rounded-xl bg-[#f2f4f8] px-4 py-2.5">
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: PLATFORM_DOT_COLORS[p] ?? '#79869a' }} />
                    <span className="text-lg font-medium capitalize text-[#485165]">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Slide>

        {/* ---- 5. Total Touch Points ---- */}
        <Slide id="slide-touchpoints" dark>
          <div className="pointer-events-none absolute top-0 right-0 flex h-full select-none items-center justify-center" style={{ width: '42%', opacity: 0.1 }}>
            <div className="h-full w-full" style={{ transform: 'rotate(12deg)' }}>
              <FluidMark />
            </div>
          </div>
          <div className="relative z-10 flex h-full flex-1 flex-col px-16 py-12">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-white/50">Distribution</div>
            <h2 className="mb-10 text-5xl font-black text-white">Total Touch Points</h2>
            <div className="flex flex-1 flex-col justify-center gap-9">
              <TouchRow stat={`${config.longFormEpisodes} LONG FORM EPISODE${episodeCount === 1 ? '' : 'S'}`} color="rgb(61, 164, 192)" posts={config.longFormPosts} hint="Our owned channels: organic posts with paid support." />
              <TouchRow stat={`${config.shortFormTopics} SHORT FORM TOPICS`} color="rgb(255, 158, 64)" posts={config.shortFormPosts} hint="Our owned channels: organic posts with paid support." />
              <TouchRow stat={`${config.clipVariations}+ "CLIPS"`} color="rgb(231, 118, 79)" posts={config.clipPosts} hint={'Organic "Clip" channels: slow-building outlets driven by association with our main channels.'} />
            </div>
          </div>
        </Slide>

        {/* ---- 6. Overall Campaign Impact ---- */}
        <Slide id="slide-impact" dark>
          <div className="pointer-events-none absolute -top-20 -right-20 select-none" style={{ opacity: 0.07 }}>
            <div className="h-96 w-96" style={{ transform: 'rotate(20deg)' }}>
              <FluidMark />
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-24 -left-16 select-none" style={{ opacity: 0.05 }}>
            <div className="h-72 w-72" style={{ transform: 'rotate(-15deg)' }}>
              <FluidMark />
            </div>
          </div>
          <div className="relative z-10 flex h-full flex-1 flex-col px-16 py-12">
            <div className="mb-10 flex items-start justify-between">
              <div>
                <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-white/50">Key Insights</div>
                <h2 className="text-6xl font-black text-white">Overall Campaign Impact</h2>
              </div>
              <div className="text-right text-base text-white/25">
                Aggregated across
                <br />
                all distribution channels
              </div>
            </div>
            <div className="grid flex-1 grid-cols-3 items-center content-center gap-x-16 gap-y-12">
              <div className="flex flex-col">
                <div className="text-7xl font-black leading-none" style={{ color: 'rgb(61, 164, 192)' }}>{views}</div>
                <div className="mt-3 text-lg font-semibold uppercase tracking-wide text-white">Total Views</div>
                <div className="mt-1 text-base text-white/35">Across all channels</div>
              </div>
              <div className="flex flex-col">
                <div className="text-7xl font-black leading-none" style={{ color: 'rgb(255, 158, 64)' }}>{impressions}</div>
                <div className="mt-3 text-lg font-semibold uppercase tracking-wide text-white">Total Impressions</div>
                <div className="mt-1 text-base text-white/35">Owned + paid-supported</div>
              </div>
              {noMetrics && (
                <div className="col-span-3 text-xl italic text-white/25">Upload platform CSV exports to populate performance data.</div>
              )}
            </div>
          </div>
        </Slide>

        {/* ---- 7. Platform Breakdown ---- */}
        <Slide id="slide-platforms">
          <div className="flex h-full flex-col px-14 py-10">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-[#3da4c0]">Enduring Content</div>
            <h2 className="mb-2 text-5xl font-black text-[#485165]">Platform Breakdown</h2>
            <p className="mb-7 text-base text-[#79869a]">
              Aggregated performance by platform across the full distribution window, long-form and short-form assets combined.
            </p>
            <div className="grid grid-cols-4 gap-5">
              {platformBreakdown.map((p) => (
                <PlatformTile key={p.platform} platform={p.platform} totalViews={p.totalViews} totalImpressions={p.totalImpressions} hasData={p.hasData} />
              ))}
            </div>
            {platformBreakdown.some((p) => !p.hasData) && (
              <div className="mt-6 flex-1 rounded-xl bg-[#f2f4f8] px-6 py-4 text-lg leading-relaxed text-[#79869a]">
                Upload CSV exports for each platform to populate performance data.
              </div>
            )}
          </div>
        </Slide>

        {/* ---- 8. Targeting Overview ---- */}
        <Slide id="slide-targeting">
          <div className="flex flex-1" style={{ minHeight: 'inherit' }}>
            <DecoPanel className="w-64 flex-shrink-0" style={{ backgroundColor: 'rgb(72, 81, 101)' }}>
              <div className="flex h-full flex-col justify-center gap-4 px-8 py-10">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-[#3da4c0]">Targeting</div>
                {TARGETING_CHIPS.map((chip) => (
                  <div key={chip} className="rounded-xl bg-white/10 px-5 py-4">
                    <div className="whitespace-pre-line text-base font-semibold leading-snug text-white">{chip}</div>
                  </div>
                ))}
              </div>
            </DecoPanel>
            <div className="flex-1 px-14 py-10">
              <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-[#3da4c0]">Precision Targeting</div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-5xl font-black text-[#485165]">Targeting Overview</h2>
              </div>
              <p className="mb-6 text-lg leading-relaxed text-[#485165]">{config.targetingNarrative}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {TARGETING_BULLETS.map((b) => (
                  <div key={b} className="flex items-start gap-3 text-base text-[#79869a]">
                    <div className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#3da4c0]" />
                    {b}
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-[#f2f4f8] pt-4 text-sm italic leading-relaxed text-[#79869a]/50">
                * Targeting capabilities vary by platform and are subject to platform-specific policies. Community Health Media applies best-available targeting methods.
              </div>
            </div>
          </div>
        </Slide>

        {/* ---- 9. Key Takeaways & Recommendations ---- */}
        <Slide id="slide-learnings">
          <div className="px-14 py-10">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-[#3da4c0]">What We Learned</div>
            <h2 className="mb-7 text-5xl font-black text-[#485165]">Key Takeaways &amp; Recommendations</h2>
            <div className="grid grid-cols-2 gap-x-14 gap-y-7">
              {config.keyLearnings.map((learning, i) => (
                <div key={learning.title} className="flex gap-4">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#3da4c0] text-sm font-black text-white">{i + 1}</div>
                  <div className="flex-1">
                    <div className="mb-1 text-lg font-bold text-[#485165]">{learning.title}</div>
                    <div className="text-lg leading-relaxed text-[#79869a]">{learning.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ---- 10. Conclusion & Executive Takeaway ---- */}
        <Slide id="slide-conclusion" dark>
          <div className="pointer-events-none absolute top-0 right-0 flex h-full select-none items-center justify-center" style={{ width: '40%', opacity: 0.09 }}>
            <div className="h-full w-full" style={{ transform: 'rotate(20deg)' }}>
              <FluidMark />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-6 right-10 select-none" style={{ opacity: 0.06, width: 180, height: 180 }}>
            <div className="h-full w-full" style={{ transform: 'rotate(-10deg)' }}>
              <FluidMark color="#e7764f" />
            </div>
          </div>
          <div className="relative z-10 flex max-w-2xl flex-1 flex-col justify-center px-16 py-14">
            <div className="mb-2 text-sm font-bold uppercase tracking-[0.28em] text-white/50">In Closing</div>
            <h2 className="mb-5 text-6xl font-black text-white">
              Conclusion &amp;
              <br />
              Executive Takeaway
            </h2>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/30">Conclusion</h3>
            </div>
            <p className="text-2xl leading-relaxed text-white/80">{config.conclusionText}</p>
          </div>
          <div className="no-print absolute bottom-10 right-12 flex items-center gap-2">
            <div className="h-5 w-5 object-contain opacity-30">
              <LogoMark size={20} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '0.28em', textTransform: 'uppercase' }}>Community Health Media</span>
          </div>
        </Slide>

        {/* ---- 11. Back cover ---- */}
        <Slide id="slide-back" dark extra="items-center justify-center">
          <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center" style={{ opacity: 0.07 }}>
            <div className="h-96 w-96">
              <FluidMark />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-10 right-16 select-none" style={{ opacity: 0.06, width: 200, height: 200 }}>
            <div className="h-full w-full" style={{ transform: 'rotate(12deg)' }}>
              <FluidMark color="#e7764f" />
            </div>
          </div>
          <div className="relative z-10 text-center">
            <div className="mb-1 flex items-center justify-center gap-4">
              <div className="h-14 w-14 object-contain">
                <LogoMark size={56} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255, 255, 255, 0.85)', letterSpacing: '0.32em', textTransform: 'uppercase' }}>Community Health Media</span>
            </div>
            <div className="mt-6 text-lg italic text-white/20">Medicine Moves Through Shared Knowledge.</div>
            <div className="mt-1 text-base text-white/15">communityhealth.media</div>
            <div className="mt-6 text-base text-white/10">Prepared for {campaign.clientSponsor}</div>
            <div className="mt-1 text-sm text-white/10">Confidential and for Internal Use Only</div>
          </div>
        </Slide>
      </div>
    </div>
  );
}
