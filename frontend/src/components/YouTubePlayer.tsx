import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string,
        config: { videoId: string; playerVars?: Record<string, number | string>; events?: { onReady?: (e: { target: YTPlayer }) => void } }
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

function getVideoId(url: string): string | null {
  const m = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/);
  return m ? m[1] : null;
}

type YouTubePlayerProps = {
  youtubeUrl: string;
  muted?: boolean;
  autoplay?: boolean;
  className?: string;
  title?: string;
};

export function YouTubePlayer({ youtubeUrl, muted = true, autoplay = true, className = '', title = '' }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const mutedRef = useRef(muted);
  const videoId = getVideoId(youtubeUrl);
  const elementId = useId().replace(/:/g, '-');

  mutedRef.current = muted;

  useEffect(() => {
    if (!videoId || !containerRef.current) return;
    const el = containerRef.current;
    el.id = elementId;

    loadYouTubeAPI().then(() => {
      if (!window.YT?.Player || !el.parentNode) return;
      playerRef.current = new window.YT.Player(elementId, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          mute: 1,
          enablejsapi: 1,
          origin: window.location.origin,
          modestbranding: 1,
        },
        events: {
          onReady() {
            if (mutedRef.current) playerRef.current?.mute();
            else playerRef.current?.unMute();
          },
        },
      });
    });

    return () => {
      playerRef.current = null;
    };
  }, [videoId, autoplay, elementId]);

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
