import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Monitor, ClipboardList, Video, Loader2, ListVideo, Mail } from 'lucide-react';
import { catalogApi } from '../../api/catalog';

function getTabs(isInApp: boolean) {
  const base = isInApp ? '/app' : '';
  return [
    { key: 'catalog', label: 'Catalog', icon: ListVideo, to: base ? '/app/catalog' : '/catalog' },
    { key: 'webinars', label: 'Webinars', icon: Monitor, to: base ? '/app/webinars' : '/webinars' },
    { key: 'surveys', label: 'Surveys', icon: ClipboardList, to: base ? '/app/surveys' : '/surveys' },
    { key: 'videos', label: 'Videos', icon: Video, to: base ? '/app/watch' : '/watch' },
  ];
}

function getEmbedUrl(youtubeUrl: string): string {
  const match = youtubeUrl.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}`;
  return youtubeUrl;
}

function ShareButtons({ title, url }: { title: string; url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, className: 'bg-[#1877f2] hover:bg-[#166fe5] text-white' },
    { name: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`, className: 'bg-black hover:bg-gray-800 text-white' },
    { name: 'Reddit', href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`, className: 'bg-[#ff4500] hover:bg-[#e03d00] text-white' },
    { name: 'Pinterest', href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`, className: 'bg-[#bd081c] hover:bg-[#a30718] text-white' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Share</h2>
      <div className="flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold uppercase tracking-wide transition-colors ${link.className}`}
          >
            {link.name}
          </a>
        ))}
        <a
          href={`mailto:?subject=${encodedTitle}&body=${encodedUrl}`}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Mail className="h-4 w-4" />
          Email
        </a>
      </div>
    </div>
  );
}

export default function PlaylistDetail() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const TABS = getTabs(isInApp);
  const catalogUrl = isInApp ? '/app/catalog' : '/catalog';
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'playlist', playlistId],
    queryFn: () => catalogApi.getPlaylist(playlistId!),
    enabled: !!playlistId,
    staleTime: 5 * 60 * 1000,
  });

  // Sync selected video from URL ?v=videoId
  const searchParams = new URLSearchParams(location.search);
  const videoIdFromUrl = searchParams.get('v');

  useEffect(() => {
    if (data?.videos && videoIdFromUrl) {
      const idx = data.videos.findIndex((v) => v.id === videoIdFromUrl);
      if (idx >= 0) setSelectedVideoIndex(idx);
    }
  }, [data?.videos, videoIdFromUrl]);

  if (!playlistId) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Invalid playlist</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Playlist not found.</p>
        <Link to={catalogUrl} className="text-sm font-medium text-gray-900 hover:underline">
          ← Back to Catalog
        </Link>
      </div>
    );
  }

  const { playlist, videos } = data;
  const safeIndex = Math.min(selectedVideoIndex, Math.max(0, videos.length - 1));
  const selectedVideo = videos[safeIndex] ?? videos[0];
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${location.pathname}${selectedVideo ? `?v=${selectedVideo.id}` : ''}`
    : '';

  return (
    <div className="bg-white min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Breadcrumb */}
        <Link
          to={catalogUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          ← Back to Catalog
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">{playlist.title}</h1>

        {/* Content type tabs */}
        <section className="flex flex-wrap gap-4">
          {TABS.map(({ key, label, icon: Icon, to }) => (
            <Link
              key={key}
              to={to}
              className="flex flex-col items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <Icon className="h-8 w-8" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </section>

        {/* Main content: Video player + Recommended sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main video area */}
          <div className="lg:col-span-8 space-y-6">
            {videos.length === 0 ? (
              <div className="aspect-video rounded-2xl bg-gray-100 flex items-center justify-center">
                <p className="text-gray-600">No videos in this playlist.</p>
              </div>
            ) : (
              <>
                {/* Embedded video player - stays in app */}
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
                  <iframe
                    key={selectedVideo.id}
                    src={getEmbedUrl(selectedVideo.youtubeUrl)}
                    title={selectedVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>

                {/* Video title banner */}
                <div className="rounded-xl bg-gray-900 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                </div>

                {/* Description - use video title as placeholder since we don't have full description from YouTube */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-600">{selectedVideo.title}</p>
                </div>

                {/* Share buttons */}
                <ShareButtons title={selectedVideo.title} url={shareUrl} />
              </>
            )}
          </div>

          {/* Right sidebar - Recommended Videos */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Recommended Videos</h3>
              {videos.length === 0 ? (
                <p className="text-sm text-gray-500">No videos in this playlist.</p>
              ) : (
                <ul className="space-y-4">
                  {videos.map((video, idx) => (
                    <li key={video.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVideoIndex(idx);
                          const url = new URL(location.pathname, window.location.origin);
                          url.searchParams.set('v', video.id);
                          window.history.replaceState({}, '', url.pathname + url.search);
                        }}
                        className={`w-full text-left rounded-lg overflow-hidden border-2 transition-all ${
                          idx === safeIndex
                            ? 'border-gray-900 ring-2 ring-gray-900 ring-offset-2'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="w-32 shrink-0 aspect-video bg-gray-200">
                            <img
                              src={video.thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {video.title}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
