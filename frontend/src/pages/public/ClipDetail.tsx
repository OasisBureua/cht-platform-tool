import { useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ArrowLeft, Clock, Eye, ThumbsUp, MessageCircle, Loader2, Calendar } from 'lucide-react';
import { ShareButtons } from '../../components/ShareButtons';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { format, isValid } from 'date-fns';
import { catalogApi } from '../../api/catalog';
import type { MediaHubClip } from '../../api/catalog';
import { pushClipView } from '../../lib/analytics';
import { clipAiSummaryText } from '../../utils/mediaHubClipText';
import { formatWordPressSeriesLabel } from '../../utils/wordpressCatalog';
import {
  getShortClipId,
  isLinkedinCatalogClipId,
  extractYoutubeVideoIdFromUrl,
} from '../../utils/clipUrl';

/** Normalize clip from API (handles snake_case and camelCase) */
function normalizeClip(raw: Record<string, unknown>): {
  doctors: string[];
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  postedAt?: string;
} {
  const get = (snake: string, camel: string) =>
    (raw[snake] ?? raw[camel]) as number | string | undefined;
  const num = (snake: string, camel: string) => {
    const v = get(snake, camel);
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') return parseInt(v, 10) || 0;
    return 0;
  };
  const arr = (snake: string, camel: string) => {
    const v = get(snake, camel);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  };
  return {
    doctors: arr('doctors', 'doctors'),
    durationSeconds: num('duration_seconds', 'durationSeconds'),
    viewCount: num('view_count', 'viewCount'),
    likeCount: num('like_count', 'likeCount'),
    commentCount: num('comment_count', 'commentCount'),
    postedAt: (get('posted_at', 'postedAt') as string) || undefined,
  };
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '-';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getClipShootId(raw: Record<string, unknown>): string | undefined {
  const v = raw.shoot_id ?? raw.shootId;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export default function ClipDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const isInApp = location.pathname.startsWith('/app');
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${location.pathname}` : '';
  const skipLinkedInClip = !!id && isLinkedinCatalogClipId(id);
  const stateClip = (location.state as { clip?: MediaHubClip } | null)?.clip;
  const stateClipMatches =
    !!stateClip &&
    !!id &&
    (stateClip.id === id || getShortClipId(stateClip.id) === id);

  const { data: clip, isLoading, isError, error } = useQuery({
    queryKey: ['catalog', 'clip', id],
    queryFn: async () => {
      const fromApi = await catalogApi.getClip(id!);
      if (fromApi) return fromApi;
      // ContentHub detail may 404; keep navigated clip so the player still works.
      if (stateClipMatches) return stateClip!;
      return null;
    },
    enabled: !!id && !skipLinkedInClip,
    retry: 0, // 404s from MediaHub are expected; don't retry
    placeholderData: stateClipMatches ? stateClip : undefined,
  });

  const clipRecord = clip && typeof clip === 'object' ? (clip as unknown as Record<string, unknown>) : undefined;
  const transcriptShootId = clipRecord ? getClipShootId(clipRecord) : undefined;

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['catalog', 'transcript', transcriptShootId],
    queryFn: () => catalogApi.getTranscript(transcriptShootId!),
    enabled: !!transcriptShootId,
    retry: 0,
  });

  const canonicalUrl = clip?.wordpress?.permalink;

  useEffect(() => {
    if (!clip?.id || !clip?.title) return;
    pushClipView({
      clip_id: clip.id,
      clip_title: clip.title,
      surface: 'clip_detail',
    });
  }, [clip?.id, clip?.title]);

  useEffect(() => {
    if (!canonicalUrl) return;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;
    return () => {
      if (link?.parentNode) link.parentNode.removeChild(link);
    };
  }, [canonicalUrl]);

  if (!id) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <p className="text-muted-foreground">Invalid clip ID</p>
      </div>
    );
  }

  if (skipLinkedInClip) {
    return <Navigate to={isInApp ? '/app/catalog' : '/catalog'} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <div className="min-h-screen bg-card flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted-foreground">Unable to load clip. {(error as Error)?.message || 'Not found.'}</p>
        <Link to={isInApp ? '/app/catalog' : '/catalog'} className="text-foreground font-medium hover:underline flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" /> {isInApp ? 'Back to Conversations' : 'Back to catalog'}
        </Link>
      </div>
    );
  }

  const youtubeUrl =
    typeof clip.youtube_url === 'string'
      ? clip.youtube_url
      : typeof (clip as { youtubeUrl?: unknown }).youtubeUrl === 'string'
        ? (clip as { youtubeUrl: string }).youtubeUrl
        : '';

  if (!extractYoutubeVideoIdFromUrl(youtubeUrl)) {
    return <Navigate to={isInApp ? '/app/catalog' : '/catalog'} replace />;
  }

  const meta = normalizeClip(clip as unknown as Record<string, unknown>);
  const aiSummary = clipAiSummaryText(clip);
  const shootIdDisplay = transcriptShootId;
  const wp = clip.wordpress;
  const seriesLabel = wp?.series?.[0]
    ? formatWordPressSeriesLabel(wp.series[0])
    : null;

  return (
    <div className="min-h-screen bg-card min-w-0">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <Link
          to={isInApp ? '/app/catalog' : '/catalog'}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {isInApp ? 'Back to Conversations' : 'Back to catalog'}
        </Link>

        {/* Video embed - IFrame API with GA4 events */}
        <div className="aspect-video w-full rounded-card overflow-hidden bg-black">
          <YouTubePlayer
            youtubeUrl={youtubeUrl}
            title={clip.title}
            autoplay={false}
            muted={false}
            className="w-full h-full"
          />
        </div>

        {/* Title + meta - all from API, works for public and /app */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{clip.title}</h1>
          {seriesLabel ? (
            <p className="mt-2 text-sm font-medium text-brand-700">{seriesLabel}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground tabular-nums">
            {meta.doctors.length > 0 && (
              <span>Featuring: {meta.doctors.join(', ')}</span>
            )}
            {meta.durationSeconds > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" /> {formatDuration(meta.durationSeconds)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" /> {formatCount(meta.viewCount)} views
            </span>
            <span className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" /> {formatCount(meta.likeCount)}
            </span>
            {meta.commentCount > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" /> {formatCount(meta.commentCount)} comments
              </span>
            )}
            {meta.postedAt && (() => {
              const posted = new Date(meta.postedAt);
              if (!isValid(posted)) return null;
              return (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Posted {format(posted, 'MMM d, yyyy')}
                </span>
              );
            })()}
          </div>
        </div>

        {/* Tags: brand: prefixed tags are internal and not shown to users */}
        {(clip.tags?.filter((t) => !String(t).startsWith('brand:')).length > 0 ||
          (wp?.categories?.length ?? 0) > 0) && (
          <div className="flex flex-wrap gap-2">
            {(wp?.categories ?? []).map((cat) => (
              <Link
                key={`wp-${cat}`}
                to={isInApp ? `/app/catalog/${cat}` : `/catalog/${cat}`}
                className="rounded-[6px] bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
              >
                {cat}
              </Link>
            ))}
            {clip.tags.filter((t) => !String(t).startsWith('brand:')).map((tag) => (
              <span
                key={tag}
                className="rounded-[6px] bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Summary: catalog description only shown when summary is absent */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Summary</h2>
          {aiSummary ? (
            <p className="text-muted-foreground whitespace-pre-wrap">{aiSummary}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Not available yet for this recording.</p>
          )}
        </div>

        {/* Share */}
        <ShareButtons
          title={clip.title}
          url={shareUrl}
          analytics={{ clip_id: clip.id, surface: 'clip_detail' }}
        />

        {/* Transcript when shoot has speech-to-text in Media Hub */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-1">Transcript</h2>
          {!shootIdDisplay ? (
            <p className="text-sm text-muted-foreground italic">Transcript not linked for this recording yet.</p>
          ) : transcriptLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : transcript ? (
            <TranscriptDisplay data={transcript} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Transcript not available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TranscriptDisplay({ data }: { data: unknown }) {
  if (!data) return null;

  // MediaHub returns { transcript: string, shoot_id, shoot_name, doctors, length }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    // Plain-string transcript (primary MediaHub shape)
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

    // Segment array under a `segments` key
    const segments = obj.segments;
    if (Array.isArray(segments)) {
      return <SegmentList segments={segments} />;
    }
  }

  // Top-level array of segments
  if (Array.isArray(data)) {
    return <SegmentList segments={data} />;
  }

  return <p className="text-sm text-muted-foreground italic">Transcript not available.</p>;
}

function SegmentList({ segments }: { segments: unknown[] }) {
  return (
    <div className="rounded-card border border-border bg-muted p-4 space-y-3 max-h-96 overflow-y-auto">
      {segments.map((seg, i) => {
        const s = seg as { speaker?: string; text?: string };
        return (
          <div key={i} className="flex gap-3">
            {s.speaker && (
              <span className="font-medium text-foreground shrink-0">{s.speaker}:</span>
            )}
            <span className="text-muted-foreground text-sm leading-relaxed">{s.text ?? JSON.stringify(seg)}</span>
          </div>
        );
      })}
    </div>
  );
}
