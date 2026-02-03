import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Volume2,
  Monitor,
  Headphones,
  FileText,
  Video,
  Clock,
  LayoutGrid,
} from 'lucide-react';

const resourceImages: Record<string, string> = {
  webinars: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1e3a5f"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Webinars</text></svg>'),
  protocols: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2d5a3d"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Protocols</text></svg>'),
  clinicals: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#374151"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Clinicals</text></svg>'),
  watch: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1e3a5f"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Watch</text></svg>'),
  reporting: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#4b5563"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Reporting</text></svg>'),
  data: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2d5a3d"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Data</text></svg>'),
  search: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#374151"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Search</text></svg>'),
};


type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
};

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
  slug: string;
};

type Resource = {
  id: string;
  title: string;
  href: string;
  icon: ReactNode;
  imageUrl: string;
};

function getMiddleIndex(length: number) {
  return length > 0 ? Math.floor(length / 2) : 0;
}

export default function Home() {
  const featuredVideos: FeaturedVideo[] = [
    { id: 'f1', title: 'Featured Video 1', imageUrl: 'https://picsum.photos/seed/cht-video1/600/400' },
    { id: 'f2', title: 'Featured Video 2', imageUrl: 'https://picsum.photos/seed/cht-video2/600/400' },
    { id: 'f3', title: 'Featured Video 3', imageUrl: 'https://picsum.photos/seed/cht-video3/600/400' },
  ];

  const treatments: Treatment[] = [
    { id: 't1', title: 'Breast Cancer', slug: 'breast-cancer', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=80' },
    { id: 't2', title: 'Weight Loss', slug: 'weight-loss', imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1600&q=80' },
    { id: 't3', title: 'Cancer Treatment', slug: 'cancer-treatment', imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=1600&q=80' },
  ];

  const midVideo = getMiddleIndex(featuredVideos.length);
  const midTreatment = getMiddleIndex(treatments.length);
  const [featuredVideoIndex, setFeaturedVideoIndex] = useState(midVideo);
  const [treatmentIndex, setTreatmentIndex] = useState(midTreatment);
  const videoScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const treatmentScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToMiddle = (ref: React.RefObject<HTMLDivElement>, selector: string, index: number) => {
      const el = ref.current;
      if (!el) return;
      const cards = el.querySelectorAll(selector);
      const target = cards[index] as HTMLElement;
      if (target) {
        target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      }
    };
    const t = requestAnimationFrame(() => {
      scrollToMiddle(videoScrollRef, '[data-video-card]', midVideo);
      scrollToMiddle(treatmentScrollRef, '[data-treatment-card]', midTreatment);
    });
    return () => cancelAnimationFrame(t);
  }, [midVideo, midTreatment]);

  const resources: Resource[] = [
    { id: 'r1', title: 'Webinars', href: '/catalog', icon: <Monitor className="h-10 w-10" />, imageUrl: resourceImages.webinars },
    { id: 'r2', title: 'Protocols', href: '/catalog', icon: <Headphones className="h-10 w-10" />, imageUrl: resourceImages.protocols },
    { id: 'r3', title: 'Clinicals', href: '/catalog', icon: <FileText className="h-10 w-10" />, imageUrl: resourceImages.clinicals },
    { id: 'r4', title: 'Watch', href: '/watch', icon: <Video className="h-10 w-10" />, imageUrl: resourceImages.watch },
    { id: 'r5', title: 'Reporting', href: '/catalog', icon: <Clock className="h-10 w-10" />, imageUrl: resourceImages.reporting },
    { id: 'r6', title: 'Data', href: '/catalog', icon: <LayoutGrid className="h-10 w-10" />, imageUrl: resourceImages.data },
    { id: 'r7', title: 'Search', href: '/search', icon: <Search className="h-10 w-10" />, imageUrl: resourceImages.search },
  ];

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative">
        <div
          className="h-[520px] w-full bg-cover bg-center bg-gray-800"
          style={{
            backgroundImage: "url('/images/hero-placeholder.svg')",
          }}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative h-full mx-auto max-w-7xl px-6 flex items-center justify-center text-center">
            <div className="max-w-3xl space-y-6">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                Innovating the next phase of
                <br />
                Healthcare through information
              </h1>
              <p className="text-sm md:text-base text-white/90 leading-relaxed">
                Community Health Media (CHM) is your full service healthcare communications partner,
                combining our production expertise with targeted multi-channel campaigns.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/join"
                  className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
                >
                  Get Started
                </Link>
                <Link
                  to="/about"
                  className="rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors inline-flex items-center gap-2"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Videos */}
      <section className="py-14 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 space-y-10">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-gray-900">
            Featured Videos
          </h2>
          <div className="relative">
            {/* Scrollable carousel - selected video centered */}
            <div
              ref={videoScrollRef}
              onScroll={() => {
                const el = videoScrollRef.current;
                if (!el) return;
                const cards = el.querySelectorAll('[data-video-card]');
                const gap = 24;
                let newIdx = 0;
                const containerCenter = el.scrollLeft + el.clientWidth / 2;
                cards.forEach((card, i) => {
                  const rect = (card as HTMLElement).getBoundingClientRect();
                  const cardCenter = rect.left - el.getBoundingClientRect().left + el.scrollLeft + rect.width / 2;
                  if (Math.abs(containerCenter - cardCenter) < (rect.width / 2 + gap)) newIdx = i;
                });
                setFeaturedVideoIndex(newIdx);
              }}
              className="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory -mx-6 px-6"
              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="shrink-0 w-[max(1rem,calc(50%-230px))] min-w-[max(1rem,calc(50%-140px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
              {featuredVideos.map((video) => (
                <Link
                  key={video.id}
                  to="/watch"
                  data-video-card
                  className="shrink-0 snap-center rounded-2xl overflow-hidden bg-gray-200 w-[280px] sm:w-[360px] md:w-[460px] h-[180px] sm:h-[220px] md:h-[280px] block"
                >
                  <img src={video.imageUrl} alt={video.title} className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
                </Link>
              ))}
              <div className="shrink-0 w-[max(1rem,calc(50%-230px))] min-w-[max(1rem,calc(50%-140px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
            </div>
            {/* Video controls - Figma design: pill-shaped bar with Play, Prev, Next, Volume */}
            <div className="mt-5 flex items-center justify-center">
              <div className="inline-flex items-center rounded-full bg-gray-200/80 px-2 py-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/watch')}
                  className="h-10 w-10 shrink-0 rounded-full bg-gray-900 flex items-center justify-center text-white hover:bg-black transition-colors"
                  aria-label="Play"
                >
                  <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = (featuredVideoIndex - 1 + featuredVideos.length) % featuredVideos.length;
                    setFeaturedVideoIndex(next);
                    videoScrollRef.current?.querySelectorAll('[data-video-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className="h-9 w-9 shrink-0 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label="Previous video"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-900" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = (featuredVideoIndex + 1) % featuredVideos.length;
                    setFeaturedVideoIndex(next);
                    videoScrollRef.current?.querySelectorAll('[data-video-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className="h-9 w-9 shrink-0 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  aria-label="Next video"
                >
                  <ChevronRight className="h-4 w-4 text-gray-900" />
                </button>
                <button
                  type="button"
                  className="h-10 w-10 shrink-0 rounded-full bg-gray-900 flex items-center justify-center text-white hover:bg-black transition-colors"
                  aria-label="Volume"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              {featuredVideos.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFeaturedVideoIndex(idx);
                    videoScrollRef.current?.querySelectorAll('[data-video-card]')[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`h-2 w-2 rounded-full transition-colors ${idx === featuredVideoIndex ? 'bg-gray-900' : 'bg-gray-300 hover:bg-gray-400'}`}
                  aria-label={`Go to video ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* View treatment specific content */}
      <section className="py-14 overflow-hidden">
        <div className="mx-auto max-w-7xl px-6 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-3xl md:text-4xl font-semibold text-gray-900">
              View treatment specific content
            </h3>
            <p className="text-sm text-gray-600">Lorem ipsum dolor sit amet consectetur suspendisse ultrices</p>
          </div>
          <div className="relative">
            <div
              ref={treatmentScrollRef}
              onScroll={() => {
                const el = treatmentScrollRef.current;
                if (!el) return;
                const cards = el.querySelectorAll('[data-treatment-card]');
                let newIdx = 0;
                const containerCenter = el.scrollLeft + el.clientWidth / 2;
                cards.forEach((card, i) => {
                  const rect = (card as HTMLElement).getBoundingClientRect();
                  const cardCenter = rect.left - el.getBoundingClientRect().left + el.scrollLeft + rect.width / 2;
                  if (Math.abs(containerCenter - cardCenter) < (rect.width / 2 + 24)) newIdx = i;
                });
                setTreatmentIndex(newIdx);
              }}
              className="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory -mx-6 px-6"
              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="shrink-0 w-[max(1rem,calc(50%-230px))] min-w-[max(1rem,calc(50%-140px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
              {treatments.map((t) => (
                <div
                  key={t.id}
                  data-treatment-card
                  className="relative shrink-0 snap-center w-[280px] sm:w-[360px] md:w-[480px] h-[180px] sm:h-[220px] md:h-[260px] rounded-2xl overflow-hidden bg-gray-200"
                >
                  <img src={t.imageUrl} alt={t.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute inset-0 p-6 flex items-center justify-between">
                    <p className="text-xl md:text-2xl font-semibold text-white">{t.title}</p>
                    <Link
                      to={`/catalog/${t.slug}`}
                      className="text-sm font-semibold text-white underline underline-offset-4 hover:text-white/90 shrink-0"
                    >
                      Explore Treatment
                    </Link>
                  </div>
                </div>
              ))}
              <div className="shrink-0 w-[max(1rem,calc(50%-230px))] min-w-[max(1rem,calc(50%-140px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              {treatments.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setTreatmentIndex(idx);
                    treatmentScrollRef.current?.querySelectorAll('[data-treatment-card]')[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                  className={`h-2 w-2 rounded-full transition-colors ${idx === treatmentIndex ? 'bg-gray-900' : 'bg-gray-300 hover:bg-gray-400'}`}
                  aria-label={`Go to treatment ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Content Title section */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-5">
            <h4 className="text-3xl font-semibold text-gray-900">Content Title</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
              ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
              fugiat nulla pariatur.
            </p>
            <Link
              to="/catalog"
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Explore
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 aspect-[3/4] max-h-[320px]">
              <img
                src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 aspect-[3/4] max-h-[320px]">
              <img
                src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=80"
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-6">
          <div className="space-y-2">
            <h5 className="text-4xl md:text-5xl font-semibold text-gray-900">Resources</h5>
            <p className="text-sm text-gray-600">Lorem ipsum dolor sit amet consectetur.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {resources.map((r) => (
              <Link
                key={r.id}
                to={r.href}
                className="relative block rounded-2xl overflow-hidden min-h-[140px] md:min-h-[160px] border border-gray-200 bg-gray-700 group"
              >
                <img src={r.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/45 group-hover:bg-black/55 transition-colors" />
                <div className="relative h-full p-4 flex flex-col justify-between min-h-[140px] md:min-h-[160px]">
                  <span className="text-white/95 group-hover:text-white transition-colors">{r.icon}</span>
                  <p className="text-sm font-semibold text-white">{r.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-6">
          <h6 className="text-4xl md:text-5xl font-semibold text-gray-900">FAQ</h6>
          <div className="border-t border-gray-200">
            {Array.from({ length: 5 }).map((_, idx) => (
              <details key={idx} className="border-b border-gray-200 py-5 group">
                <summary className="list-none flex items-center justify-between cursor-pointer">
                  <span className="text-base font-medium text-gray-900">Lorem Ipsum</span>
                  <span className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 shrink-0 ml-2">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 max-w-3xl">
                  Placeholder answer content. Replace with real FAQ copy from stakeholders.
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Brand CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 text-center space-y-6">
          <p className="text-3xl md:text-5xl font-serif text-gray-900 leading-tight">
            A media company that's
            <br />
            about more than just content
          </p>
          <Link
            to="/catalog"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Explore
          </Link>
        </div>
      </section>
    </div>
  );
}
