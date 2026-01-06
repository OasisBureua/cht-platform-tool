import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { programsApi, type Program, type Video } from '../api/programs';
import { ChevronLeft, RotateCcw, CheckCircle2, ExternalLink } from 'lucide-react';

const TEMP_USER_ID = '1234567890';

// How often we sync progress to backend (seconds)
const SYNC_INTERVAL_SECONDS = 15;

// Consider complete at 95% to avoid rounding issues
const COMPLETE_THRESHOLD = 0.95;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function findVideo(programs: Program[], videoId: string) {
  for (const program of programs) {
    const video = (program.videos || []).find((v) => v.id === videoId);
    if (video) return { program, video };
  }
  return null;
}

export default function WatchVideo() {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.getAll,
  });

  const found = useMemo(() => {
    if (!programs || !videoId) return null;
    return findVideo(programs, videoId);
  }, [programs, videoId]);

  const storageKey = useMemo(() => {
    return videoId ? `watch_progress_${TEMP_USER_ID}_${videoId}` : '';
  }, [videoId]);

  const [watchedSeconds, setWatchedSeconds] = useState<number>(0);
  const [lastSyncedSeconds, setLastSyncedSeconds] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const duration = found?.video.duration ?? 0;

  // Load saved local progress
  useEffect(() => {
    if (!storageKey || !duration) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { watchedSeconds?: number };
      if (typeof parsed.watchedSeconds === 'number') {
        const clamped = clamp(parsed.watchedSeconds, 0, duration);
        setWatchedSeconds(clamped);
        setLastSyncedSeconds(clamped);
      }
    } catch {
      // ignore
    }
  }, [storageKey, duration]);

  // Persist local progress
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ watchedSeconds }));
    } catch {
      // ignore
    }
  }, [storageKey, watchedSeconds]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return clamp(watchedSeconds / duration, 0, 1);
  }, [watchedSeconds, duration]);

  const completed = progress >= COMPLETE_THRESHOLD;

  const updateMutation = useMutation({
    mutationFn: (payload: {
      watchedSeconds: number;
      progress: number;
      completed: boolean;
    }) => {
      if (!videoId) throw new Error('Missing videoId');
      return programsApi.updateVideoProgress(
        TEMP_USER_ID,
        videoId,
        payload.watchedSeconds,
        payload.progress,
        payload.completed
      );
    },
    onError: (e) => {
      setSyncError(e instanceof Error ? e.message : 'Failed to sync progress');
    },
    onSuccess: () => setSyncError(null),
  });

  const syncNow = (forcedSeconds?: number) => {
    if (!videoId || !duration) return;

    const seconds = typeof forcedSeconds === 'number' ? forcedSeconds : watchedSeconds;
    const p = clamp(seconds / duration, 0, 1);
    const isCompleted = p >= COMPLETE_THRESHOLD;

    if (updateMutation.isPending) return;

    updateMutation.mutate({
      watchedSeconds: seconds,
      progress: p,
      completed: isCompleted,
    });

    setLastSyncedSeconds(seconds);
  };

  // Timer: increments watched seconds while "started" and tab visible
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasStarted || !duration) return;

    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      setWatchedSeconds((s) => clamp(s + 1, 0, duration));
    };

    timerRef.current = window.setInterval(tick, 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [hasStarted, duration]);

  // Periodic sync (every 15s) + on completion
  useEffect(() => {
    if (!hasStarted || !duration) return;

    const shouldSync =
      watchedSeconds - lastSyncedSeconds >= SYNC_INTERVAL_SECONDS ||
      (completed && watchedSeconds !== lastSyncedSeconds);

    if (!shouldSync) return;

    syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedSeconds, lastSyncedSeconds, completed, hasStarted, duration]);

  // Sync on tab hide / page close
  useEffect(() => {
    if (!hasStarted) return;

    const onVis = () => {
      if (document.visibilityState !== 'visible') syncNow();
    };

    const onBeforeUnload = () => {
      // best effort sync (may not always complete)
      syncNow();
    };

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStarted, watchedSeconds, duration]);

  if (isLoading) return <LoadingSpinner />;

  if (!videoId) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">Video not found</h1>
        <p className="text-sm text-gray-600">Missing video id.</p>
      </div>
    );
  }

  if (!found) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h1 className="text-xl font-semibold text-gray-900">Video not found</h1>
          <p className="mt-1 text-sm text-gray-600">
            We couldn’t locate that video in your current programs feed.
          </p>
        </div>
      </div>
    );
  }

  const { program, video } = found;
  const totalLabel = duration ? formatTime(duration) : '—';
  const watchedLabel = formatTime(watchedSeconds);

  const canResume = watchedSeconds > 0 && watchedSeconds < duration;

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <button
          onClick={() => navigate(`/webinars/${program.id}`)}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          Webinar Details
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>

      {/* Header / Progress */}
      <section className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900">{video.title}</p>
          <p className="text-sm text-gray-600">{video.description || program.title}</p>
          <p className="text-sm text-gray-700">
            {program.sponsorName} • {video.platform} • {duration ? `${Math.round(duration / 60)} min` : 'Video'}
          </p>

          {/* Progress bar */}
          <div className="pt-3">
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-gray-900 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
              <span>
                {watchedLabel} / {totalLabel}
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>

            {completed ? (
              <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </div>
            ) : null}

            {syncError ? (
              <p className="mt-2 text-xs text-red-600">
                Sync issue: {syncError}
              </p>
            ) : null}
          </div>

          {/* Actions */}
          <div className="pt-4 flex flex-wrap gap-2">
            {!hasStarted ? (
              <button
                onClick={() => setHasStarted(true)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                {canResume ? 'Resume' : 'Start Watching'}
              </button>
            ) : (
              <button
                onClick={() => setHasStarted(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Pause
              </button>
            )}

            <button
              onClick={() => {
                setHasStarted(false);
                setWatchedSeconds(0);
                setLastSyncedSeconds(0);
                syncNow(0);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Progress
            </button>

            {/* Dev-only helper (avoid exposing in prod) */}
            {import.meta.env.DEV ? (
              <button
                onClick={() => {
                  const forcedSeconds = duration ? Math.ceil(duration * COMPLETE_THRESHOLD) : watchedSeconds;
                  setWatchedSeconds(forcedSeconds);
                  syncNow(forcedSeconds);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Complete (DEV)
              </button>
            ) : null}

            {updateMutation.isPending ? (
              <span className="text-xs font-medium text-gray-600 self-center">Syncing…</span>
            ) : null}
          </div>
        </div>
      </section>

      {/* Video player */}
      <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="aspect-video w-full bg-black">
          <iframe
            title={video.title}
            src={video.embedUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>
    </div>
  );
}
