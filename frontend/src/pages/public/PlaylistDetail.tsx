import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { catalogApi } from '../../api/catalog';
import { ShareButtons } from '../../components/ShareButtons';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { APP_CATALOG_PLAYLISTS_BROWSE } from '../../components/navigation/appNavItems';
import { clipDisplaySummary } from '../../utils/mediaHubClipText';
import { WORDPRESS_CATALOG_STALE_MS } from '../../utils/wordpressCatalog';
import { pushClipView } from '../../lib/analytics';

export default function PlaylistDetail() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const catalogUrl = isInApp ? APP_CATALOG_PLAYLISTS_BROWSE : '/catalog?view=playlists';
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['catalog', 'playlist', playlistId],
    queryFn: () => catalogApi.getPlaylist(playlistId!),
    enabled: !!playlistId,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
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

  // Derive selected video safely: may be undefined before data loads
  const [hiddenVideoIds, setHiddenVideoIds] = useState<Set<string>>(() => new Set());
  const videos = (data?.videos ?? []).filter((v) => v.id && !hiddenVideoIds.has(v.id));
  const safeIndex = Math.min(selectedVideoIndex, Math.max(0, videos.length - 1));
  const selectedVideo = videos[safeIndex];

  useEffect(() => {
    setHiddenVideoIds(new Set());
  }, [playlistId]);

  useEffect(() => {
    if (selectedVideoIndex > 0 && selectedVideoIndex >= videos.length) {
      setSelectedVideoIndex(Math.max(0, videos.length - 1));
    }
  }, [videos.length, selectedVideoIndex]);

  useEffect(() => {
    if (!selectedVideo?.id || !selectedVideo?.title) return;
    pushClipView({
      clip_id: selectedVideo.id,
      clip_title: selectedVideo.title,
      surface: 'playlist_detail',
      playlist_id: playlistId,
    });
  }, [selectedVideo?.id, selectedVideo?.title, playlistId]);

  // All hooks must come before any early returns (Rules of Hooks)
  const { data: clipDetail } = useQuery({
    queryKey: ['catalog', 'clip', selectedVideo?.id],
    queryFn: () => catalogApi.getClip(selectedVideo!.id),
    enabled: !!selectedVideo?.id,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    retry: 0, // 404s from MediaHub are expected; don't retry
  });

  const shootId = (clipDetail as Record<string, unknown> | undefined)?.shoot_id as string | undefined;
  const summary = clipDetail ? clipDisplaySummary(clipDetail as Record<string, unknown>) : '';

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['catalog', 'transcript', shootId],
    queryFn: () => catalogApi.getTranscript(shootId!),
    enabled: !!shootId,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    retry: 0,
  });

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${location.pathname}${selectedVideo ? `?v=${selectedVideo.id}` : ''}`
    : '';

  // Early returns after all hooks
  if (!playlistId) {
    return (
      <div className="bg-card min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Invalid playlist</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-card min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-card min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Playlist not found.</p>
        <Link to={catalogUrl} className="text-sm font-medium text-foreground hover:underline">
          ← Back to Catalog
        </Link>
      </div>
    );
  }

  const { playlist } = data;

  return (
    <div className="bg-card min-h-screen min-w-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Breadcrumb */}
        <Link
          to={catalogUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Catalog
        </Link>

        <h1 className="text-4xl md:text-5xl font-bold text-foreground">{playlist.title}</h1>

        {/* Main content: Video player + Recommended sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main video area */}
          <div className="lg:col-span-8 space-y-6">
            {videos.length === 0 ? (
              <div className="aspect-video rounded-card bg-muted flex items-center justify-center">
                <p className="text-muted-foreground">No videos in this playlist.</p>
              </div>
            ) : (
              <>
                {/* Embedded video player - IFrame API with GA4 events */}
                <div className="aspect-video w-full rounded-card overflow-hidden bg-black" key={selectedVideo.id}>
                  <YouTubePlayer
                    youtubeUrl={selectedVideo.youtubeUrl}
                    title={selectedVideo.title}
                    autoplay={false}
                    muted={false}
                    className="w-full h-full"
                  />
                </div>

                {/* Video title banner */}
                <div className="rounded-card bg-brand-600 px-6 py-4">
                  <h2 className="text-xl font-bold text-white">{selectedVideo.title}</h2>
                </div>

                {/* Summary */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Summary</h3>
                  {summary ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">{summary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Summary not yet available for this clip.</p>
                  )}
                </div>

                {/* Share buttons */}
                <ShareButtons
                  title={selectedVideo.title}
                  url={shareUrl}
                  analytics={{ clip_id: selectedVideo.id, surface: 'playlist_detail' }}
                />

                {/* Transcript */}
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">Transcript</h3>
                  {!shootId ? (
                    <p className="text-sm text-muted-foreground italic">Transcript not available for this clip.</p>
                  ) : transcriptLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : transcript ? (
                    <PlaylistTranscriptDisplay data={transcript} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Transcript not available.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right sidebar - Playlist */}
          <div className="lg:col-span-4">
            <div className="rounded-card border border-border bg-muted p-6 sticky top-24">
              <h3 className="text-lg font-bold text-foreground mb-1">Playlist</h3>
              <p className="text-sm text-muted-foreground mb-4">{videos.length} video{videos.length !== 1 ? 's' : ''}</p>
              {videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No videos in this playlist.</p>
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
                        className={`w-full overflow-hidden rounded-[6px] border-2 text-left transition-[border-color,box-shadow] ${
                          idx === safeIndex
                            ? 'border-foreground ring-2 ring-gray-900 ring-offset-2'
                            : 'border-transparent hover:border-border'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className="w-32 shrink-0 aspect-video bg-muted">
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              onError={() => {
                                setHiddenVideoIds((prev) => {
                                  if (prev.has(video.id)) return prev;
                                  const next = new Set(prev);
                                  next.add(video.id);
                                  return next;
                                });
                              }}
                            />
                          </div>
                          <div className="flex-1 min-w-0 py-1">
                            <p className="text-sm font-medium text-foreground line-clamp-2">
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

function PlaylistTranscriptDisplay({ data }: { data: unknown }) {
  if (!data) return null;
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    if (typeof obj.transcript === 'string' && obj.transcript.trim()) {
      const paragraphs = obj.transcript.split(/\n+/).filter(Boolean);
      return (
        <div className="rounded-card border border-border bg-muted p-4 space-y-3 max-h-96 overflow-y-auto">
          {obj.shoot_name && (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{String(obj.shoot_name)}</p>
          )}
          {paragraphs.map((para, i) => (
            <p key={i} className="text-muted-foreground text-sm leading-relaxed">{para}</p>
          ))}
        </div>
      );
    }
    const segments = obj.segments;
    if (Array.isArray(segments)) {
      return <SegmentList segments={segments} />;
    }
  }
  if (Array.isArray(data)) return <SegmentList segments={data} />;
  return <p className="text-sm text-muted-foreground italic">Transcript not available.</p>;
}

function SegmentList({ segments }: { segments: unknown[] }) {
  return (
    <div className="rounded-card border border-border bg-muted p-4 space-y-3 max-h-96 overflow-y-auto">
      {segments.map((seg, i) => {
        const s = seg as { speaker?: string; text?: string };
        return (
          <div key={i} className="flex gap-3">
            {s.speaker && <span className="font-medium text-foreground shrink-0">{s.speaker}:</span>}
            <span className="text-muted-foreground text-sm leading-relaxed">{s.text ?? JSON.stringify(seg)}</span>
          </div>
        );
      })}
    </div>
  );
}
