import { useState, useEffect } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { catalogApi } from '../../api/catalog';
import { ShareButtons } from '../../components/ShareButtons';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { APP_CATALOG_PLAYLISTS_BROWSE } from '../../components/navigation/appNavItems';
import { clipDisplaySummary } from '../../utils/contentHubClipText';
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

  const [syncedFrom, setSyncedFrom] = useState<{ videos: unknown; v: string | null } | null>(null);
  if (!syncedFrom || syncedFrom.videos !== data?.videos || syncedFrom.v !== videoIdFromUrl) {
    setSyncedFrom({ videos: data?.videos, v: videoIdFromUrl });
    if (data?.videos && videoIdFromUrl) {
      const idx = data.videos.findIndex((v) => v.id === videoIdFromUrl);
      if (idx >= 0) setSelectedVideoIndex(idx);
    }
  }

  // Derive selected video safely: may be undefined before data loads
  const [hiddenVideoIds, setHiddenVideoIds] = useState<Set<string>>(() => new Set());
  const [prevPlaylistId, setPrevPlaylistId] = useState(playlistId);
  if (playlistId !== prevPlaylistId) {
    setPrevPlaylistId(playlistId);
    setHiddenVideoIds(new Set());
  }
  const videos = (data?.videos ?? []).filter((v) => v.id && !hiddenVideoIds.has(v.id));
  const safeIndex = Math.min(selectedVideoIndex, Math.max(0, videos.length - 1));
  const selectedVideo = videos[safeIndex];

  if (selectedVideoIndex > 0 && selectedVideoIndex >= videos.length) {
    setSelectedVideoIndex(Math.max(0, videos.length - 1));
  }

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

  const shootId = clipDetail?.shoot_id ?? clipDetail?.shootId;
  const summary = clipDetail
    ? clipDisplaySummary(clipDetail as unknown as Record<string, unknown>)
    : '';

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
    <div className={isInApp ? 'min-w-0 space-y-5' : 'min-h-screen min-w-0 bg-ground'}>
      {/* In the app the page runs the full width of the shell; the public
          route keeps the site's rail. */}
      <div className={isInApp ? 'space-y-5' : 'rail space-y-5 py-8 md:py-12'}>
        <Button to={catalogUrl} variant="outline" size="sm">
          <ChevronLeft className="size-4" aria-hidden />
          Playlists
        </Button>

        <div>
          <p className="eyebrow text-anchor">
            Playlist · {videos.length} video{videos.length !== 1 ? 's' : ''}
          </p>
          <h1 className="display mt-2 max-w-[36ch] text-balance text-display-s leading-[1.08] text-text md:text-display-m">
            {playlist.title}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] 2xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="min-w-0 space-y-5">
            {videos.length === 0 ? (
              <div className="flex aspect-video items-center justify-center rounded-card bg-surface-2">
                <p className="text-body-s text-muted2">No videos in this playlist yet.</p>
              </div>
            ) : (
              <>
                <div className="aspect-video w-full overflow-hidden rounded-card bg-black shadow-card" key={selectedVideo.id}>
                  <YouTubePlayer
                    youtubeUrl={selectedVideo.youtubeUrl}
                    title={selectedVideo.title}
                    autoplay={false}
                    muted={false}
                    className="h-full w-full"
                  />
                </div>

                <div>
                  <p className="meta tabular-nums text-faint">
                    Now playing · {safeIndex + 1} of {videos.length}
                  </p>
                  <h2 className="display mt-1 text-body-l text-text md:text-display-s">{selectedVideo.title}</h2>
                </div>

                <section className="card p-5">
                  <h3 className="display text-body-m text-text">Summary</h3>
                  {summary ? (
                    <p className="prose-lede mt-2 whitespace-pre-wrap text-body-s text-dim">{summary}</p>
                  ) : (
                    <p className="mt-2 text-body-s text-muted2">The summary for this clip is on its way.</p>
                  )}
                </section>

                <ShareButtons
                  title={selectedVideo.title}
                  url={shareUrl}
                  analytics={{ clip_id: selectedVideo.id, surface: 'playlist_detail' }}
                />

                <section>
                  <h3 className="display mb-3 text-body-m text-text">Transcript</h3>
                  {!shootId ? (
                    <p className="text-body-s text-muted2">No transcript for this clip.</p>
                  ) : transcriptLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted2" />
                  ) : transcript ? (
                    <PlaylistTranscriptDisplay data={transcript} />
                  ) : (
                    <p className="text-body-s text-muted2">No transcript for this clip.</p>
                  )}
                </section>
              </>
            )}
          </div>

          <aside className="min-w-0">
            <div className="card flex flex-col p-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)]">
              <div className="border-b border-hairline px-4 py-3">
                <h3 className="display text-body-m text-text">Up next</h3>
                <p className="meta tabular-nums text-faint">
                  {videos.length} video{videos.length !== 1 ? 's' : ''}
                </p>
              </div>
              {videos.length === 0 ? (
                <p className="p-4 text-body-s text-muted2">No videos in this playlist yet.</p>
              ) : (
                <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                  {videos.map((video, idx) => (
                    <li key={video.id}>
                      <button
                        type="button"
                        aria-current={idx === safeIndex ? 'true' : undefined}
                        onClick={() => {
                          setSelectedVideoIndex(idx);
                          const url = new URL(location.pathname, window.location.origin);
                          url.searchParams.set('v', video.id);
                          window.history.replaceState({}, '', url.pathname + url.search);
                        }}
                        className={[
                          'flex w-full gap-3 rounded-[8px] p-2 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                          idx === safeIndex ? 'bg-anchor/10 ring-1 ring-anchor/40' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <span className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-[6px] bg-surface-2">
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover"
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
                          <span className="meta absolute bottom-1 start-1 rounded-[4px] bg-black/70 px-1 tabular-nums text-white">
                            {idx + 1}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 py-0.5 text-body-s font-medium leading-snug text-text line-clamp-3">
                          {video.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
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
          {typeof obj.shoot_name === 'string' && obj.shoot_name ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{obj.shoot_name}</p>
          ) : null}
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
