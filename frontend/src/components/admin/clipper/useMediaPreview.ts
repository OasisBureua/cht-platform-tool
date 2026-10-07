import { useEffect, useState } from 'react';

/**
 * Frames and sound for the timeline, for files opened from the computer.
 * Zoom recordings play from storage that won't share their bytes with the
 * browser, so they get neither and the timeline falls back to speech marks.
 */

export type Thumb = { t: number; url: string };

/** Frames spread across the video, filled in as they're captured. */
export function useFilmstrip(url: string | null, duration: number, count = 28): Thumb[] {
  const [thumbs, setThumbs] = useState<Thumb[]>([]);
  const [seenKey, setSeenKey] = useState('');
  const key = `${url ?? ''}|${duration}|${count}`;
  if (key !== seenKey) {
    setSeenKey(key);
    setThumbs([]);
  }

  useEffect(() => {
    if (!url || !(duration > 0)) return undefined;
    let cancelled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.src = url;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 108;
    const ctx = canvas.getContext('2d');
    const seekTo = (t: number) =>
      new Promise<void>((resolve, reject) => {
        const done = () => {
          video.removeEventListener('seeked', done);
          video.removeEventListener('error', fail);
          resolve();
        };
        const fail = () => {
          video.removeEventListener('seeked', done);
          video.removeEventListener('error', fail);
          reject(new Error('seek failed'));
        };
        video.addEventListener('seeked', done);
        video.addEventListener('error', fail);
        video.currentTime = t;
      });
    (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          if (video.readyState >= 1) resolve();
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
          video.addEventListener('error', () => reject(new Error('load failed')), { once: true });
        });
        const out: Thumb[] = [];
        for (let i = 0; i < count && !cancelled; i++) {
          const t = ((i + 0.5) / count) * duration;
          await seekTo(t);
          if (cancelled || !ctx) break;
          const vw = video.videoWidth || 16, vh = video.videoHeight || 9;
          const scale = Math.max(canvas.width / vw, canvas.height / vh);
          const w = vw * scale, h = vh * scale;
          ctx.drawImage(video, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          out.push({ t, url: canvas.toDataURL('image/jpeg', 0.62) });
          if (i % 4 === 3 || i === count - 1) setThumbs([...out]);
        }
      } catch {
        /* no frames: the lane stays plain */
      }
    })();
    return () => {
      cancelled = true;
      video.removeAttribute('src');
      video.load();
    };
  }, [url, duration, count]);

  return thumbs;
}

/**
 * Loudness across the file, as peaks in 0–1. Decoded at a low sample rate
 * to keep memory small; files over `maxBytes` are skipped.
 */
export function useWaveform(file: File | null, buckets = 1200, maxBytes = 300 * 1024 * 1024): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [seen, setSeen] = useState<File | null>(null);
  if (seen !== file) {
    setSeen(file);
    setPeaks(null);
  }

  useEffect(() => {
    if (!file || file.size > maxBytes || typeof OfflineAudioContext === 'undefined') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const bytes = await file.arrayBuffer();
        const ctx = new OfflineAudioContext(1, 1, 8000);
        const audio = await ctx.decodeAudioData(bytes);
        const data = audio.getChannelData(0);
        const size = Math.max(1, Math.floor(data.length / buckets));
        const out: number[] = [];
        let max = 0;
        for (let b = 0; b < buckets; b++) {
          let peak = 0;
          const from = b * size, to = Math.min(data.length, from + size);
          for (let i = from; i < to; i += 4) {
            const v = Math.abs(data[i]);
            if (v > peak) peak = v;
          }
          out.push(peak);
          if (peak > max) max = peak;
        }
        if (!cancelled) setPeaks(max > 0 ? out.map((p) => p / max) : out);
      } catch {
        /* a codec the browser can't decode: no waveform */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, buckets, maxBytes]);

  return peaks;
}
