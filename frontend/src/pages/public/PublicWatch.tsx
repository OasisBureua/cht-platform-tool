import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Play, Clock, Share2 } from 'lucide-react';

type WatchItem = {
  id: string;
  title: string;
  description: string;
  speaker: string;
  role?: string;
  durationMin?: number;
  posterUrl: string;
  embedUrl?: string; // optional; if present, we show iframe
  collectionTitle?: string;
};

type CollectionCard = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
};

const MOCK_LIBRARY: WatchItem[] = [
  {
    id: 'bc-101',
    title: 'Breast Cancer 101: Current Landscape',
    description:
      'A clinical overview of the current diagnostic and treatment landscape, including decision points and patient selection considerations.',
    speaker: 'Dr. Paolo Tarantino',
    role: 'Medical Oncologist',
    durationMin: 18,
    posterUrl:
      'https://images.unsplash.com/photo-1580281657527-47f249e8f7b7?auto=format&fit=crop&w=1600&q=80',
    // Optional: if you have a real embed URL, add it here:
    // embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    collectionTitle: 'Breast Cancer • Foundations',
  },
  {
    id: 'bc-her2-1',
    title: 'HER2+ Treatment Sequencing',
    description:
      'Key updates in sequencing strategies and how to apply evidence across stages.',
    speaker: 'Dr. Jason Mouabbi',
    role: 'Breast Medical Oncologist',
    durationMin: 16,
    posterUrl:
      'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=1600&q=80',
    collectionTitle: 'Breast Cancer • HER2+',
  },
];

const MOCK_COLLECTIONS: CollectionCard[] = [
  {
    id: 'c1',
    title: 'Breast Cancer',
    subtitle: 'Video collections + webinars',
    href: '/catalog/breast-cancer',
    imageUrl:
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'c2',
    title: 'Lung Cancer',
    subtitle: 'Biomarkers + strategy',
    href: '/catalog/lung-cancer',
    imageUrl:
      'https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=1600&q=80',
  },
  {
    id: 'c3',
    title: 'Weight Loss',
    subtitle: 'Metabolic health',
    href: '/catalog/weight-loss',
    imageUrl:
      'https://images.unsplash.com/photo-1559757175-5700dde67548?auto=format&fit=crop&w=1600&q=80',
  },
];

export default function PublicWatch() {
  const { contentId } = useParams<{ contentId: string }>();
  const navigate = useNavigate();

  const item = useMemo(() => {
    const found = MOCK_LIBRARY.find((x) => x.id === contentId);
    return (
      found ??
      ({
        id: contentId || 'unknown',
        title: 'Video Title',
        description:
          'This is a demo watch page. Replace this mock content with API data when ready.',
        speaker: 'Featured Speaker',
        role: 'Specialist',
        durationMin: 12,
        posterUrl:
          'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=1600&q=80',
        collectionTitle: 'Collection',
      } as WatchItem)
    );
  }, [contentId]);

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700 w-fit"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <Link
              to="/catalog"
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Content Library
            </Link>
            <button
              type="button"
              onClick={() => {
                // demo share: copy URL
                try {
                  navigator.clipboard.writeText(window.location.href);
                } catch {
                  // ignore
                }
              }}
              className="rounded-full border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 inline-flex items-center gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
        </div>

        {/* Main content: player + side panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Player */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black">
              <div className="relative w-full aspect-video">
                {item.embedUrl ? (
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={item.embedUrl}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="absolute inset-0 h-full w-full object-cover opacity-90"
                    />
                    <div className="absolute inset-0 bg-black/35" />

                    <button
                      className="absolute inset-0 flex items-center justify-center"
                      onClick={() => {
                        // demo-only: no real playback
                      }}
                      aria-label="Play"
                    >
                      <span className="h-16 w-16 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                        <Play className="h-7 w-7 text-white" />
                      </span>
                    </button>

                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
                      <p className="text-white text-sm font-semibold line-clamp-1">
                        {item.collectionTitle || 'Collection'}
                      </p>
                      {typeof item.durationMin === 'number' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/90">
                          <Clock className="h-4 w-4" />
                          {item.durationMin} min
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-600">Now Watching</p>
              <h1 className="text-2xl font-semibold text-gray-900 leading-snug">
                {item.title}
              </h1>
              <p className="text-sm text-gray-600">{item.collectionTitle}</p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">Description</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <p className="text-sm font-semibold text-gray-900">Speaker</p>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-700">
                      {initials(item.speaker)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {item.speaker}
                    </p>
                    {item.role ? (
                      <p className="text-sm text-gray-600">{item.role}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-900">Collections</p>
                <p className="mt-1 text-sm text-gray-600">
                  Explore more curated disease-area content.
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  <Link
                    to="/catalog/breast-cancer"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Breast Cancer
                  </Link>
                  <Link
                    to="/catalog/lung-cancer"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    Lung Cancer
                  </Link>
                  <Link
                    to="/catalog"
                    className="text-sm font-semibold text-gray-900 hover:text-gray-700 inline-flex items-center gap-2 mt-1"
                  >
                    View all collections <span>→</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* CTA block (demo) */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Want more access?</p>
              <p className="text-sm text-gray-600">
                Join to receive personalized content recommendations and updates.
              </p>
              <div className="flex gap-3">
                <Link
                  to="/join"
                  className="flex-1 rounded-full bg-gray-900 px-5 py-2 text-sm font-semibold text-white text-center hover:bg-black"
                >
                  Get Started
                </Link>
                <Link
                  to="/login"
                  className="flex-1 rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 border border-gray-200 text-center hover:bg-gray-50"
                >
                  Login
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {/* Collections grid */}
        <section className="space-y-5 pt-2">
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900">
                Video Collections
              </h2>
              <p className="text-sm text-gray-600">
                Browse disease-area collections and curated educational playlists.
              </p>
            </div>

            <Link
              to="/catalog"
              className="text-sm font-semibold text-gray-900 hover:text-gray-700"
            >
              View All →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {MOCK_COLLECTIONS.map((c) => (
              <CollectionCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CollectionCard({ c }: { c: CollectionCard }) {
  return (
    <Link
      to={c.href}
      className="group rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="relative h-[200px]">
        <img
          src={c.imageUrl}
          alt={c.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
        <div className="relative h-full p-5 flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-xl font-semibold text-white">{c.title}</p>
            <p className="text-sm text-white/90">{c.subtitle}</p>
          </div>
          <span className="text-white/90 text-lg">›</span>
        </div>
      </div>

      <div className="p-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Explore</p>
        <span className="text-gray-400 group-hover:text-gray-700 transition-colors">
          →
        </span>
      </div>
    </Link>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CHM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
