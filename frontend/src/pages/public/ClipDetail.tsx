import { useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, Eye, ThumbsUp, MessageCircle, Loader2, Calendar } from 'lucide-react';
import { ShareButtons } from '../../components/ShareButtons';
import { YouTubePlayer } from '../../components/YouTubePlayer';
import { format, isValid } from 'date-fns';
import { catalogApi } from '../../api/catalog';
import { clipAiSummaryText, clipCatalogDescriptionText } from '../../utils/mediaHubClipText';
import { isLinkedinCatalogClipId, extractYoutubeVideoIdFromUrl } from '../../utils/clipUrl';

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

  const { data: clip, isLoading, isError, error } = useQuery({
    queryKey: ['catalog', 'clip', id],
    queryFn: () => catalogApi.getClip(id!),
    enabled: !!id && !skipLinkedInClip,
    retry: 0, // 404s from MediaHub are expected; don't retry
  });

  const clipRecord = clip && typeof clip === 'object' ? (clip as unknown as Record<string, unknown>) : undefined;
  const transcriptShootId = clipRecord ? getClipShootId(clipRecord) : undefined;

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
    queryKey: ['catalog', 'transcript', transcriptShootId],
    queryFn: () => catalogApi.getTranscript(transcriptShootId!),
    enabled: !!transcriptShootId,
    retry: 0,
  });

  if (!id) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-600">Invalid clip ID</p>
      </div>
    );
  }

  if (skipLinkedInClip) {
    return <Navigate to={isInApp ? '/app/catalog' : '/catalog'} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError || !clip) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-gray-600">Unable to load clip. {(error as Error)?.message || 'Not found.'}</p>
        <Link to={isInApp ? '/app/catalog' : '/catalog'} className="text-gray-900 font-medium hover:underline flex items-center gap-2">
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
  const catalogDescription = clipCatalogDescriptionText(clip);
  const shootIdDisplay = transcriptShootId;
  /** Catalog copy is only shown when there is no usable AI summary */
  const showCatalogDescription = aiSummary === '' && catalogDescription !== '';

  return (
    <div className="min-h-screen bg-white min-w-0">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <Link
          to={isInApp ? '/app/catalog' : '/catalog'}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" /> {isInApp ? 'Back to Conversations' : 'Back to catalog'}
        </Link>

        {/* Video embed - IFrame API with GA4 events */}
        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black">
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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{clip.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500 tabular-nums">
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

        {/* Tags */}
        {clip.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {clip.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Summary — catalog description only shown when summary is absent */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Summary</h2>
          {aiSummary ? (
            <p className="text-gray-600 whitespace-pre-wrap">{aiSummary}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">Not available yet for this recording.</p>
          )}
        </div>

        {showCatalogDescription ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Catalog description</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{catalogDescription}</p>
          </div>
        ) : null}

        {/* Share */}
        <ShareButtons title={clip.title} url={shareUrl} />

        {/* Transcript when shoot has speech-to-text in Media Hub */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Transcript</h2>
          {!shootIdDisplay ? (
            <p className="text-sm text-gray-400 italic">Transcript not linked for this recording yet.</p>
          ) : transcriptLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          ) : transcript ? (
            <TranscriptDisplay data={transcript} />
          ) : (
            <p className="text-sm text-gray-400 italic">Transcript not available.</p>
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
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 max-h-96 overflow-y-auto">
          {obj.shoot_name && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{String(obj.shoot_name)}</p>
          )}
          {paragraphs.map((para, i) => (
            <p key={i} className="text-gray-600 text-sm leading-relaxed">{para}</p>
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

  return <p className="text-sm text-gray-400 italic">Transcript not available.</p>;
}

function SegmentList({ segments }: { segments: unknown[] }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 max-h-96 overflow-y-auto">
      {segments.map((seg, i) => {
        const s = seg as { speaker?: string; text?: string };
        return (
          <div key={i} className="flex gap-3">
            {s.speaker && (
              <span className="font-medium text-gray-900 shrink-0">{s.speaker}:</span>
            )}
            <span className="text-gray-600 text-sm leading-relaxed">{s.text ?? JSON.stringify(seg)}</span>
          </div>
        );
      })}
    </div>
  );
}
