import { useEffect, useRef } from 'react';

/**
 * The masthead band behind a faculty portrait.
 *
 * Same cluster motif as the homepage map, at banner scale: three hubs
 * of banded motes, seeded from the person's own id so a profile always
 * draws the same field and two profiles never look identical.
 *
 * Decorative, so aria-hidden. It paints one static frame — a banner
 * that drifts behind a name is movement with nothing to say, and this
 * page can carry several canvases already.
 */

const TONES = ['--ink-pink', '--ink-purple', '--anchor', '--ink-cyan', '--ink-coral', '--ink-green'];

const R0 = [4, 22, 44, 70];
const R1 = [22, 44, 70, 104];
const OP = [0.6, 0.42, 0.28, 0.16];
const SZ = [2.6, 2.1, 1.7, 1.4];
const CUT = [0.34, 0.6, 0.82, 1];

/** Deterministic per profile, so the field is stable across visits. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ProfileBanner({ seed, className = '' }: { seed: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const read = (name: string) => {
      const t = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return t ? `hsl(${t})` : 'hsl(212 100% 38%)';
    };

    const draw = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width;
      const h = r.height;
      ctx.clearRect(0, 0, w, h);

      const rand = seeded(seed);
      const pick = Math.floor(rand() * TONES.length);
      const hubs = [
        { x: w * (0.62 + rand() * 0.1), y: h * 0.34, tone: TONES[pick] },
        { x: w * (0.82 + rand() * 0.1), y: h * 0.72, tone: TONES[(pick + 2) % TONES.length] },
        { x: w * (0.5 + rand() * 0.08), y: h * 0.82, tone: TONES[(pick + 4) % TONES.length] },
      ];
      const colours = new Map(hubs.map((hb) => [hb.tone, read(hb.tone)]));

      const n = Math.max(180, Math.min(520, Math.round((w * h) / 260)));
      for (let i = 0; i < n; i += 1) {
        const hub = hubs[i % hubs.length];
        const u = rand();
        let b = 0;
        while (u > CUT[b]) b += 1;
        const a = rand() * Math.PI * 2;
        const rad = R0[b] + rand() * (R1[b] - R0[b]);
        const px = hub.x + Math.cos(a) * rad;
        const py = hub.y + Math.sin(a) * rad * 0.62;
        if (px < -10 || px > w + 10 || py < -10 || py > h + 10) continue;
        ctx.globalAlpha = OP[b] * (0.6 + rand() * 0.4);
        ctx.fillStyle = colours.get(hub.tone)!;
        ctx.fillRect(px, py, SZ[b], SZ[b]);
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [seed]);

  return <canvas ref={ref} aria-hidden className={`size-full ${className}`} />;
}
