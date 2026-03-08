import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Play,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  Monitor,
  Headphones,
  FileText,
  Video,
  Clock,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import { catalogApi, type CatalogItem } from '../../api/catalog';
import { YouTubePlayer } from '../../components/YouTubePlayer';

const resourceImages: Record<string, string> = {
  webinars: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1e3a5f"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Webinars</text></svg>'),
  protocols: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2d5a3d"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Protocols</text></svg>'),
  clinicals: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#374151"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Clinicals</text></svg>'),
  watch: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#1e3a5f"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Conversations</text></svg>'),
  reporting: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#4b5563"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Reporting</text></svg>'),
  data: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#2d5a3d"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Data</text></svg>'),
  search: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#374151"/><text x="200" y="155" fill="white" font-family="sans-serif" font-size="16" text-anchor="middle" fill-opacity="0.8">Search</text></svg>'),
};


type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
  youtubeUrl?: string;
};

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
  slug: string;
  videoNames: string[];
  playlistUrl: string;
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

function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function catalogToTreatment(p: CatalogItem): Treatment {
  const thumb = p.thumbnailUrl || 'https://via.placeholder.com/400x225?text=Playlist';
  return {
    id: p.id,
    title: p.title,
    imageUrl: thumb,
    slug: p.id,
    videoNames: p.videoNames || [],
    playlistUrl: `/catalog/playlist/${p.id}`,
  };
}

const FALLBACK_HER2: Treatment[] = [
  { id: 'bp1', title: 'HER2+ Big Picture & Practice Change', slug: 'her2-big-picture', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'bp2', title: 'First-Line & Sequencing Decisions', slug: 'first-line-sequencing', imageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'bp3', title: 'High-Risk & CNS Disease', slug: 'high-risk-cns', imageUrl: 'https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
];

const FALLBACK_HR: Treatment[] = [
  { id: 'hr1', title: 'HR+ Big Picture & Practice Change', slug: 'hr-big-picture', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr2', title: 'First-Line & Sequencing Decisions', slug: 'hr-first-line-sequencing', imageUrl: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
  { id: 'hr3', title: 'High-Risk & CNS Disease', slug: 'hr-high-risk-cns', imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80', videoNames: ['Video Name', 'Video Name', 'Video Name', 'Video Name'], playlistUrl: '/catalog' },
];

export default function Home() {
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const { data: randomVideos = [], isLoading: randomVideosLoading } = useQuery({
    queryKey: ['catalog', 'random-videos'],
    queryFn: () => catalogApi.getRandomVideos(6),
    staleTime: 5 * 60 * 1000,
  });

  const biomarkerPlaylists = useMemo(() => {
    if (playlists.length === 0) return FALLBACK_HER2;
    const her2 = playlists.filter(
      (p) => /HER2|her2|DESTINY-Breast|HER2\+|HER2 Low|HER2 Positive/i.test(p.title)
    );
    return her2.length > 0 ? her2.map(catalogToTreatment) : FALLBACK_HER2;
  }, [playlists]);

  const hrPlusPlaylists = useMemo(() => {
    if (playlists.length === 0) return FALLBACK_HR;
    const hrOrTnbc = playlists.filter(
      (p) => /HR\+|hormone|TNBC|mTNBC|CDK4|endocrine|triple.?negative/i.test(p.title) &&
        !/HER2|her2|DESTINY-Breast/i.test(p.title)
    );
    if (hrOrTnbc.length > 0) return hrOrTnbc.map(catalogToTreatment);
    const nonHer2 = playlists.filter(
      (p) => !/HER2|her2|DESTINY-Breast|HER2\+|HER2 Low|HER2 Positive/i.test(p.title)
    );
    return nonHer2.length > 0 ? nonHer2.map(catalogToTreatment) : FALLBACK_HR;
  }, [playlists]);

  const featuredVideos: FeaturedVideo[] = useMemo(() => {
    return randomVideos.map((v) => ({
      id: v.id,
      title: v.title,
      imageUrl: v.thumbnailUrl || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
      youtubeUrl: v.youtubeUrl,
    }));
  }, [randomVideos]);

  const midVideo = getMiddleIndex(featuredVideos.length);
  const midPlaylist = getMiddleIndex(biomarkerPlaylists.length);
  const midHrPlaylist = getMiddleIndex(hrPlusPlaylists.length);
  const [featuredVideoIndex, setFeaturedVideoIndex] = useState(midVideo);
  const [playlistIndex, setPlaylistIndex] = useState(midPlaylist);
  const [hrPlaylistIndex, setHrPlaylistIndex] = useState(midHrPlaylist);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [modalAnimate, setModalAnimate] = useState(false);
  const [modalPlaying, setModalPlaying] = useState(false);
  const [inlinePlayingId, setInlinePlayingId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const videoScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const treatmentScrollRef = useRef<HTMLDivElement>(null);
  const hrScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
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
      scrollToMiddle(treatmentScrollRef, '[data-treatment-card]', midPlaylist);
      scrollToMiddle(hrScrollRef, '[data-hr-card]', midHrPlaylist);
      window.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(t);
  }, [midVideo, midPlaylist, midHrPlaylist]);

  useEffect(() => {
    if (expandedVideoId) {
      setModalPlaying(false);
      setModalAnimate(false);
      const id = requestAnimationFrame(() => setModalAnimate(true));
      return () => cancelAnimationFrame(id);
    } else {
      setModalPlaying(false);
      setModalAnimate(false);
    }
  }, [expandedVideoId]);


  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedVideoId) setExpandedVideoId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedVideoId]);

  const resources: Resource[] = [
    { id: 'r1', title: 'Webinars', href: '/webinars', icon: <Monitor className="h-10 w-10" />, imageUrl: resourceImages.webinars },
    { id: 'r2', title: 'Protocols', href: '/catalog', icon: <Headphones className="h-10 w-10" />, imageUrl: resourceImages.protocols },
    { id: 'r3', title: 'Clinicals', href: '/catalog', icon: <FileText className="h-10 w-10" />, imageUrl: resourceImages.clinicals },
    { id: 'r4', title: 'Conversations', href: '/watch', icon: <Video className="h-10 w-10" />, imageUrl: resourceImages.watch },
    { id: 'r5', title: 'Reporting', href: '/catalog', icon: <Clock className="h-10 w-10" />, imageUrl: resourceImages.reporting },
    { id: 'r6', title: 'Data', href: '/catalog', icon: <LayoutGrid className="h-10 w-10" />, imageUrl: resourceImages.data },
    { id: 'r7', title: 'Search', href: '/search', icon: <Search className="h-10 w-10" />, imageUrl: resourceImages.search },
  ];

  const expandedVideo = expandedVideoId ? featuredVideos.find((v) => v.id === expandedVideoId) : null;

  return (
    <div className="bg-white min-w-0 overflow-x-hidden">
      {/* Video pop-out modal */}
      {expandedVideo && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 transition-opacity duration-200 ${modalAnimate ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setExpandedVideoId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
        >
          <div
            className={`relative w-full max-w-6xl rounded-2xl overflow-hidden bg-black shadow-2xl transition-all duration-300 ${modalAnimate ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMuted((m) => !m)}
                className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => setExpandedVideoId(null)}
                className="h-10 w-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative aspect-video w-full bg-black">
              {modalPlaying && expandedVideo.youtubeUrl ? (
                <YouTubePlayer
                  youtubeUrl={expandedVideo.youtubeUrl}
                  muted={isMuted}
                  autoplay
                  className="absolute inset-0 w-full h-full"
                  title={expandedVideo.title}
                />
              ) : (
                <>
                  <img
                    src={expandedVideo.imageUrl}
                    alt={expandedVideo.title}
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    {expandedVideo.youtubeUrl ? (
                      <button
                        type="button"
                        onClick={() => setModalPlaying(true)}
                        className="h-16 w-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-900 shadow-lg transition-colors"
                        aria-label="Play video"
                      >
                        <Play className="h-8 w-8 ml-1" fill="currentColor" />
                      </button>
                    ) : (
                      <Link
                        to={expandedVideo.id.startsWith('f') ? '/watch' : `/catalog/clip/${expandedVideo.id}`}
                        className="h-16 w-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-900 shadow-lg transition-colors"
                        aria-label="Conversations"
                      >
                        <Play className="h-8 w-8 ml-1" fill="currentColor" />
                      </Link>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 bg-gray-900 text-white">
              <h3 className="text-lg font-semibold">{expandedVideo.title}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative">
        <div
          className="min-h-[400px] sm:min-h-[460px] md:h-[520px] w-full bg-cover bg-center bg-gray-800"
          style={{
            backgroundImage: "url('/images/hero-bg.png')",
          }}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative h-full min-h-[400px] sm:min-h-[460px] md:min-h-[520px] mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-center text-center">
            <div className="max-w-3xl space-y-6">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                The future of healthcare marketing and education
              </h1>
              <p className="text-sm md:text-base text-white/90 leading-relaxed">
                Community Health Technologies is redefining how pharma reaches healthcare audiences—and educates them where they actively consume and trust information.
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
      <section className="py-10 sm:py-14 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8 sm:space-y-10">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-gray-900">
            Featured Videos
          </h2>

          {/* Loading skeleton — shown only while random videos are fetching */}
          {randomVideosLoading && (
            <div className="flex items-center justify-center gap-4 sm:gap-6 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`shrink-0 rounded-2xl bg-gray-200 animate-pulse w-[280px] sm:w-[360px] md:w-[460px] ${i === 1 ? 'h-[200px] sm:h-[240px] md:h-[300px]' : 'h-[180px] sm:h-[220px] md:h-[280px]'}`}
                />
              ))}
            </div>
          )}

          {!randomVideosLoading && featuredVideos.length > 0 && (
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
                if (newIdx !== featuredVideoIndex) setInlinePlayingId(null);
                setFeaturedVideoIndex(newIdx);
              }}
              className="flex items-center gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory -mx-4 sm:-mx-6 px-4 sm:px-6"
              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
              {featuredVideos.map((video, idx) => {
                const isSelected = idx === featuredVideoIndex;
                const isPlayingInline = inlinePlayingId === video.id && isSelected;
                const baseH = 'h-[180px] sm:h-[220px] md:h-[280px]';
                const selectedH = 'h-[200px] sm:h-[240px] md:h-[300px]';
                return (
                  <div
                    key={video.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedVideoId(video.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setExpandedVideoId(video.id)}
                    data-video-card
                    className={`shrink-0 snap-center rounded-2xl overflow-hidden bg-gray-200 w-[280px] sm:w-[360px] md:w-[460px] block relative transition-[height] duration-300 cursor-pointer ${isSelected ? selectedH : baseH}`}
                  >
                    {isPlayingInline && video.youtubeUrl ? (
                      <div
                        className="absolute inset-0 w-full h-full"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <YouTubePlayer
                          youtubeUrl={video.youtubeUrl}
                          muted={isMuted}
                          autoplay
                          className="absolute inset-0 w-full h-full"
                          title={video.title}
                        />
                      </div>
                    ) : (
                      <img src={video.imageUrl} alt={video.title} className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedVideoId(video.id);
                      }}
                      className="absolute top-3 right-3 h-9 w-9 rounded-lg bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                      aria-label="Play full screen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
            </div>
            {/* Video controls - Figma design: pill-shaped bar with Play, Prev, Next, Volume */}
            <div className="mt-5 flex items-center justify-center overflow-x-auto">
              <div className="inline-flex items-center rounded-full bg-gray-200/80 px-2 py-2 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const video = featuredVideos[featuredVideoIndex];
                    if (video?.youtubeUrl) {
                      setInlinePlayingId(inlinePlayingId === video.id ? null : video.id);
                    } else {
                      if (video?.id) setExpandedVideoId(video.id);
                    }
                  }}
                  className="h-10 w-10 shrink-0 rounded-full bg-gray-900 flex items-center justify-center text-white hover:bg-black transition-colors"
                  aria-label="Play"
                >
                  <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePlayingId(null);
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
                    setInlinePlayingId(null);
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
                  onClick={() => setIsMuted((m) => !m)}
                  className="h-10 w-10 shrink-0 rounded-full bg-gray-900 flex items-center justify-center text-white hover:bg-black transition-colors"
                  aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
          )}
        </div>
      </section>

      {/* Biomarker Playlists - treatment specific content */}
      <section className="py-10 sm:py-14 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6 sm:space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-3xl md:text-4xl font-semibold text-gray-900">
              Biomarker Playlists
            </h3>
            <p className="text-lg md:text-xl font-medium text-gray-900">HER2+</p>
          </div>
          <div className="relative">
            {playlistsLoading && playlists.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
              </div>
            ) : (
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
                setPlaylistIndex(newIdx);
              }}
              className="flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory -mx-4 sm:-mx-6 px-4 sm:px-6"
              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
              {biomarkerPlaylists.map((t) => (
                <div
                  key={t.id}
                  data-treatment-card
                  className="shrink-0 snap-center w-[280px] sm:w-[320px] md:w-[360px] rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm flex flex-col"
                >
                  <Link to={t.playlistUrl} className="aspect-video w-full bg-gray-200 overflow-hidden block">
                    <img src={t.imageUrl} alt={t.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <Link to={t.playlistUrl} className="block mb-3">
                      <h4 className="text-base md:text-lg font-semibold text-gray-900 hover:underline">{t.title}</h4>
                    </Link>
                    <ul className="space-y-1.5 mb-4 flex-1 text-sm text-gray-600">
                      {(t.videoNames.length > 0 ? t.videoNames : ['Video Name', 'Video Name', 'Video Name', 'Video Name']).slice(0, 4).map((label, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-gray-400">•</span>
                          <span className="truncate">{label}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={t.playlistUrl}
                      className="inline-flex self-end rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
                    >
                      Play all
                    </Link>
                  </div>
                </div>
              ))}
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
            </div>
            )}
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = (playlistIndex - 1 + biomarkerPlaylists.length) % biomarkerPlaylists.length;
                  setPlaylistIndex(next);
                  treatmentScrollRef.current?.querySelectorAll('[data-treatment-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className="h-10 w-10 rounded-full bg-white border-2 border-gray-900 flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = (playlistIndex + 1) % biomarkerPlaylists.length;
                  setPlaylistIndex(next);
                  treatmentScrollRef.current?.querySelectorAll('[data-treatment-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className="h-10 w-10 rounded-full bg-white border-2 border-gray-900 flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Biomarker Playlists - HR+ */}
      <section className="py-10 sm:py-14 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6 sm:space-y-8">
          <h3 className="text-3xl md:text-4xl font-semibold text-center text-gray-900">
            HR+
          </h3>
          <div className="relative">
            {playlistsLoading && playlists.length === 0 ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
              </div>
            ) : (
            <div
              ref={hrScrollRef}
              onScroll={() => {
                const el = hrScrollRef.current;
                if (!el) return;
                const cards = el.querySelectorAll('[data-hr-card]');
                let newIdx = 0;
                const containerCenter = el.scrollLeft + el.clientWidth / 2;
                cards.forEach((card, i) => {
                  const rect = (card as HTMLElement).getBoundingClientRect();
                  const cardCenter = rect.left - el.getBoundingClientRect().left + el.scrollLeft + rect.width / 2;
                  if (Math.abs(containerCenter - cardCenter) < (rect.width / 2 + 24)) newIdx = i;
                });
                setHrPlaylistIndex(newIdx);
              }}
              className="flex gap-6 overflow-x-auto overflow-y-hidden pb-4 scroll-smooth snap-x snap-mandatory -mx-6 px-6"
              style={{ scrollbarWidth: 'thin', WebkitOverflowScrolling: 'touch' }}
            >
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
              {hrPlusPlaylists.map((t) => (
                <div
                  key={t.id}
                  data-hr-card
                  className="shrink-0 snap-center w-[280px] sm:w-[320px] md:w-[360px] rounded-2xl overflow-hidden bg-white border border-gray-200 shadow-sm flex flex-col"
                >
                  <Link to={t.playlistUrl} className="aspect-video w-full bg-gray-200 overflow-hidden block">
                    <img src={t.imageUrl} alt={t.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                  </Link>
                  <div className="p-5 flex flex-col flex-1">
                    <Link to={t.playlistUrl} className="block mb-3">
                      <h4 className="text-base md:text-lg font-semibold text-gray-900 hover:underline">{t.title}</h4>
                    </Link>
                    <ul className="space-y-1.5 mb-4 flex-1 text-sm text-gray-600">
                      {(t.videoNames.length > 0 ? t.videoNames : ['Video Name', 'Video Name', 'Video Name', 'Video Name']).slice(0, 4).map((label, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-gray-400">•</span>
                          <span className="truncate">{label}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      to={t.playlistUrl}
                      className="inline-flex self-end rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors"
                    >
                      Play all
                    </Link>
                  </div>
                </div>
              ))}
              <div className="shrink-0 w-[max(1rem,calc(50%-150px))] min-w-[max(1rem,calc(50%-140px))] sm:min-w-[max(1rem,calc(50%-180px))] md:min-w-[max(1rem,calc(50%-230px))]" aria-hidden />
            </div>
            )}
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = (hrPlaylistIndex - 1 + hrPlusPlaylists.length) % hrPlusPlaylists.length;
                  setHrPlaylistIndex(next);
                  hrScrollRef.current?.querySelectorAll('[data-hr-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className="h-10 w-10 rounded-full bg-white border-2 border-gray-900 flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = (hrPlaylistIndex + 1) % hrPlusPlaylists.length;
                  setHrPlaylistIndex(next);
                  hrScrollRef.current?.querySelectorAll('[data-hr-card]')[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className="h-10 w-10 rounded-full bg-white border-2 border-gray-900 flex items-center justify-center text-gray-900 hover:bg-gray-50 transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* About Us teaser */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-start">
          <div className="space-y-5">
            <h4 className="text-3xl font-semibold text-gray-900">About Us</h4>
            <p className="text-sm text-gray-700 leading-relaxed">
              Built by veterans from Live Nation, Lionsgate, television production, and health insurance—not traditional pharma agencies—we apply proven entertainment and media strategies to healthcare marketing and medical education.
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              We don&apos;t just create content. We ensure it reaches the right audiences where they&apos;re already paying attention.
            </p>
            <Link
              to="/about"
              className="inline-flex rounded-full bg-gray-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Learn More
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

      {/* Who We Reach */}
      <section className="py-10 sm:py-14 border-t border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h4 className="text-3xl font-semibold text-gray-900 mb-8">Who We Reach</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="font-semibold text-gray-900 mb-2">HCPs</p>
              <p className="text-sm text-gray-600 leading-relaxed">Beyond conferences and CME, where they actually consume content</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="font-semibold text-gray-900 mb-2">Patients</p>
              <p className="text-sm text-gray-600 leading-relaxed">Pre or active treatment, searching for credible information</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <p className="font-semibold text-gray-900 mb-2">Caregivers</p>
              <p className="text-sm text-gray-600 leading-relaxed">Making decisions, seeking guidance, needing support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Resources */}
      <section className="py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
          <div className="space-y-2">
            <h5 className="text-4xl md:text-5xl font-semibold text-gray-900">Resources</h5>
            <p className="text-sm text-gray-600">Lorem ipsum dolor sit amet consectetur.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
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

      {/* How We Help Pharma - FAQ accordion */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 mb-8 md:mb-10">
            How We Help Pharma Educate Healthcare Audiences
          </h2>
          <div>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-base font-medium text-gray-900">AI-Powered Content Automation</span>
                </span>
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 shrink-0 ml-4 group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="pt-2 pb-5 pr-4 pl-4 text-sm text-gray-600 leading-relaxed">
                Turn one medical webinar or clinical presentation into 20+ platform-specific assets—social posts, podcast clips, infographics, and more.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-base font-medium text-gray-900">Multi-Audience Reach</span>
                </span>
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 shrink-0 ml-4 group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="pt-2 pb-5 pr-4 pl-4 text-sm text-gray-600 leading-relaxed">
                Engage KOLs, HCPs, patients, and caregivers through a unified content ecosystem.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-base font-medium text-gray-900">Entertainment-Grade Distribution</span>
                </span>
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 shrink-0 ml-4 group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="pt-2 pb-5 pr-4 pl-4 text-sm text-gray-600 leading-relaxed">
                Leverage podcasts, social media, live events, and owned digital properties to reach audiences where they consume trusted information.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-base font-medium text-gray-900">First-Party HCP Intelligence</span>
                </span>
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 shrink-0 ml-4 group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="pt-2 pb-5 pr-4 pl-4 text-sm text-gray-600 leading-relaxed">
                Access proprietary data for precision targeting, lookalike audiences, and measurable activation.
              </p>
            </details>
            <details className="group">
              <summary className="list-none flex items-center justify-between cursor-pointer py-5 border-b border-gray-200 group-open:border-b-0">
                <span className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-base font-medium text-gray-900">Real Engagement Analytics</span>
                </span>
                <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-900 shrink-0 ml-4 group-open:rotate-45">
                  <span className="text-lg font-light leading-none">+</span>
                </span>
              </summary>
              <p className="pt-2 pb-5 pr-4 pl-4 text-sm text-gray-600 leading-relaxed">
                Move beyond impressions. Track who watched, who shared, and who took meaningful action.
              </p>
            </details>
          </div>
          <div className="mt-10">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-2.5 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* A media company thats about more than just content - Figma Frame 13 */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-gray-900 mb-8 md:mb-10">
            A media company thats about more than just content
          </h2>
          <Link
            to="/join"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-10 py-4 text-base font-medium text-white hover:bg-black transition-colors min-w-[208px]"
          >
            Join Us
          </Link>
        </div>
      </section>
    </div>
  );
}
