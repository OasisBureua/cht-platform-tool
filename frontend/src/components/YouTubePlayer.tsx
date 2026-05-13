import { useEffect, useId, useRef } from 'react';
import { pushVideoEvent } from '../lib/analytics';
import { extractYoutubeVideoIdFromUrl } from '../utils/clipUrl';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: {
          videoId: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number; target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
}

function loadYouTubeAPI(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const first = document.getElementsByTagName('script')[0];
    first?.parentNode?.insertBefore(tag, first);
  });
}

type YouTubePlayerProps = {
  youtubeUrl: string;
  muted?: boolean;
  autoplay?: boolean;
  className?: string;
  title?: string;
};

const PROGRESS_MILESTONES = [25, 50, 75];

export function YouTubePlayer({ youtubeUrl, muted = true, autoplay = true, className = '', title = '' }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const mutedRef = useRef(muted);
  const progressFiredRef = useRef<Set<number>>(new Set());
  const startFiredRef = useRef(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoId = extractYoutubeVideoIdFromUrl(youtubeUrl);
  const videoTitle = title || 'Untitled';
  const elementId = useId().replace(/:/g, '-');

  mutedRef.current = muted;

  useEffect(() => {
    if (!videoId || !containerRef.current) return;
    const el = containerRef.current;
    el.id = elementId;
    progressFiredRef.current = new Set();
    startFiredRef.current = false;

    loadYouTubeAPI().then(() => {
      if (!window.YT?.Player || !el.parentNode) return;
      const PlayerState = window.YT.PlayerState;

      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: autoplay ? 1 : 0,
          enablejsapi: 1,
          origin: window.location.origin,
          modestbranding: 1,
        },
        events: {
          onReady() {
            if (mutedRef.current) playerRef.current?.mute();
            else playerRef.current?.unMute();
          },
          onStateChange(e: { data: number; target: YTPlayer }) {
            const player = e.target;
            if (e.data === PlayerState.PLAYING) {
              if (!startFiredRef.current) {
                startFiredRef.current = true;
                pushVideoEvent('video_start', { video_id: videoId, video_title: videoTitle });
              }
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              progressIntervalRef.current = setInterval(() => {
                if (!player.getDuration || player.getPlayerState?.() !== PlayerState.PLAYING) return;
                const current = player.getCurrentTime();
                const duration = player.getDuration();
                if (duration <= 0) return;
                const pct = Math.floor((current / duration) * 100);
                for (const m of PROGRESS_MILESTONES) {
                  if (pct >= m && !progressFiredRef.current.has(m)) {
                    progressFiredRef.current.add(m);
                    pushVideoEvent('video_progress', {
                      video_id: videoId,
                      video_title: videoTitle,
                      progress_percent: m,
                    });
                  }
                }
              }, 500);
            } else if (e.data === PlayerState.ENDED) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
              pushVideoEvent('video_complete', { video_id: videoId, video_title: videoTitle });
            } else if (e.data === PlayerState.PAUSED || e.data === PlayerState.CUED) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = null;
              }
            }
          },
        },
      });
    });

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      playerRef.current = null;
    };
  }, [videoId, videoTitle, autoplay, elementId]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) p.mute();
    else p.unMute();
  }, [muted]);

  if (!videoId) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100%' }}
      aria-label={title}
    />
  );
}
