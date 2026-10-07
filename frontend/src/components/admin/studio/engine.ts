import { useCallback, useRef, useState } from 'react';

/**
 * The CHM Studio pages (public/studio) draw the artwork; the platform's
 * native studio pages own the controls. Each studio page, opened with
 * `?embed&canvas`, shows only its canvas and exposes `window.__engine`,
 * which these pages drive. Same origin, so blob: URLs from uploads load.
 */

export type StudioImage = { url: string; name: string; zoom?: number };

export type ThumbEngine = {
  ready: true;
  meta: () => { size: [number, number]; areas: { name: string; hex: string }[]; layouts: [string, string][] };
  set: (s: Record<string, unknown>) => Promise<void>;
  regenerate: () => number;
  exportPng: () => void;
};

export type SocialSlide = { kind: 'cover' | 'point' | 'quote' | 'cta'; eyebrow: string; headline: string; body: string; credit: string; unit: string; images: StudioImage[] };
export type SocialEngine = {
  ready: true;
  meta: () => {
    width: number;
    styles: Record<string, string>;
    hints: Record<string, string>;
    grounds: Record<string, [string, string][]>;
    groundHints: Record<string, string>;
    areas: { name: string; hex: string }[];
    sample: Omit<SocialSlide, 'unit' | 'images'>[];
  };
  height: () => number;
  set: (s: Record<string, unknown>) => Promise<void>;
  thumbs: (width?: number) => Promise<string[]>;
  exportSlide: () => void;
  exportZip: () => void;
};

export type DeckField = [key: string, label: string, kind: 'text' | 'textarea' | 'lines'];
export type DeckSlide = { type: string; images: StudioImage[]; [field: string]: unknown };
export type DeckEngine = {
  ready: true;
  meta: () => { size: [number, number]; types: Record<string, { name: string; images: number; fields: DeckField[] }>; sample: DeckSlide[]; title: string };
  set: (s: Record<string, unknown>) => Promise<void>;
  thumbs: (width?: number) => Promise<string[]>;
  exportSlide: () => void;
  exportZip: () => void;
  exportPdf: () => void;
};

export function useStudioEngine<E>(page: 'index' | 'social' | 'deck', onReady?: (engine: E) => void) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [engine, setEngine] = useState<E | null>(null);
  const ready = useRef(onReady);
  const onLoad = useCallback(() => {
    const look = (n: number) => {
      const w = ref.current?.contentWindow as (Window & { __engine?: E }) | null | undefined;
      if (w?.__engine) {
        ready.current?.(w.__engine);
        setEngine(w.__engine);
      } else if (n < 60) window.setTimeout(() => look(n + 1), 100);
    };
    look(0);
  }, []);
  return { ref, engine, onLoad, src: `/studio/${page}.html?embed&canvas` };
}

/** Image files to studio images, kept as blob: URLs the canvas page can load. */
export function filesToImages(files: FileList | File[] | null, max: number): StudioImage[] {
  if (!files) return [];
  return Array.from(files)
    .filter((f) => f.type.startsWith('image/'))
    .slice(0, Math.max(0, max))
    .map((f) => ({ url: URL.createObjectURL(f), name: f.name.replace(/\.[^.]+$/, ''), zoom: 1 }));
}
