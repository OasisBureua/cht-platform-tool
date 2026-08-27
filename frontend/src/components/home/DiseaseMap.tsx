import { useEffect, useRef } from 'react';
import DISEASE_AREAS from '../../data/disease-areas';

/**
 * The library, drawn as a map: one hub per tag the catalogue is actually
 * filed under, each carrying a body of orbiting sessions.
 *
 * The hubs come from `disease-areas.ts` — the `clipTags` of the areas
 * marked active — rather than from a list written here. That matters:
 * the map is a capability claim, and a hand-written six would keep
 * claiming six long after the data said otherwise. Today the active set
 * is breast, so the hubs are its biomarkers.
 *
 * Five bands per hub, not one ring. Each band is a shell with its own
 * radius, angular speed, weight and size; the shear between them is what
 * makes the cluster read as a body with depth. The outer two reach into
 * their neighbours, which stitches separate wheels into one map.
 *
 * Every radius scales with the viewport. At a fixed size the clusters
 * are the same dots on a 2560px display as on a 900px one, which reads
 * as sparse rather than as a map. The placement is deliberately
 * irregular too — an even ring reads as a clock face — but the jitter
 * is a fixed table rather than random, so a resize does not reshuffle
 * the whole map.
 *
 * Under the hero's copy the map is dimmed, not cut. A hard hole forces
 * every hub outside a column that is most of the hero wide, which
 * pushes the clusters into the frame edges and leaves them reading as
 * fragments. Dimming to a tenth lets the hubs sit at a comfortable
 * radius and stay whole, with a ground scrim in the hero carrying the
 * rest of the contrast. Labels still cull completely — a word at ten
 * percent under a headline is noise, not information.
 */

type Hub = { label: string; tone: string; x: number; y: number };
type Mote = { h: Hub; a: number; r: number; sp: number; o: number; z: number };

/** Deep in the light appearance, bright in the dark one. */
const TONES = ['--ink-pink', '--ink-purple', '--anchor', '--ink-cyan', '--ink-coral', '--ink-green'];

const R0 = [4, 24, 46, 72, 106];
const R1 = [24, 46, 72, 106, 152];

/**
 * Where each hub sits, as a fraction of the canvas. Hand-placed rather
 * than laid on a ring: an even ring reads as a clock face, and these
 * are the positions that actually work around the headline, the lede
 * and the search box. Add a seventh hub and it wraps with an offset.
 */
const HUB_SPOTS: [number, number][] = [
  [0.42, 0.19],
  [0.8, 0.35],
  [0.2, 0.62],
  [0.54, 0.66],
  [0.41, 0.93],
  [0.83, 0.86],
];
const SP = [0.0043, 0.0029, 0.0019, 0.0013, 0.00084];
const OP = [0.42, 0.3, 0.21, 0.14, 0.09];
const SZ = [2.15, 1.8, 1.5, 1.25, 1.1];
const CUT = [0.3, 0.54, 0.73, 0.88, 1];

/** What the map fades to under the hero copy, rather than vanishing. */
const DIM = 0.1;

/** `biomarker:HER2-low` -> `HER2-LOW`. */
function labelsFromCatalog(): string[] {
  const tags = DISEASE_AREAS.filter((a) => a.active).flatMap((a) => a.clipTags ?? []);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const label = (t.split(':').pop() ?? t).trim().toUpperCase();
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out.slice(0, 8);
}

export function DiseaseMap({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const labels = labelsFromCatalog();
    if (labels.length < 3) return;

    let w = 0;
    let h = 0;
    let hubs: Hub[] = [];
    let motes: Mote[] = [];
    /** Viewport scale for every radius. Set in `seed`. */
    let k = 1;

    const read = (name: string, fallback: string) => {
      const t = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return t ? `hsl(${t})` : fallback;
    };

    const seed = () => {
      // Grows with the width, which is the dimension that actually
      // changes between a laptop and a wide display. The hero's height
      // barely moves, so the vertical squash carries the difference.
      k = Math.max(0.8, Math.min(1.75, w / 820));

      hubs = labels.map((label, i) => {
        const [fx, fy] = HUB_SPOTS[i % HUB_SPOTS.length];
        // Past the first pass, nudge so a seventh hub does not land
        // exactly on top of the first.
        const wrap = Math.floor(i / HUB_SPOTS.length) * 0.06;
        return {
          label,
          tone: TONES[i % TONES.length],
          x: w * (fx + wrap),
          y: h * (fy - wrap),
        };
      });
      const n = Math.max(900, Math.min(6000, Math.round((w * h) / 46)));
      motes = Array.from({ length: n }, (_, i) => {
        const hub = hubs[i % hubs.length];
        const u = Math.random();
        let b = 0;
        while (u > CUT[b]) b += 1;
        return {
          h: hub,
          a: Math.random() * Math.PI * 2,
          r: (R0[b] + Math.random() * (R1[b] - R0[b])) * k,
          sp: SP[b] + Math.random() * SP[b] * 0.9,
          o: OP[b] + Math.random() * 0.4,
          z: SZ[b],
        };
      });
    };

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = r.width;
      h = r.height;
      seed();
    };
    fit();

    let frame = 0;
    const still = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const tone = new Map(hubs.map((hb) => [hb.tone, read(hb.tone, 'hsl(212 100% 38%)')]));
      const label = read('--muted2', 'hsl(30 5% 36%)');

      // The copy column lives in here. The exponent squares the corners
      // off toward a rounded rectangle, which is the actual shape of a
      // headline over a lede over a search box. Motes inside it drop to
      // DIM rather than disappearing.
      const cx = w / 2;
      const cy = h * 0.48;
      const crx = w * 0.3;
      const cry = h * 0.27;
      const shape = (px: number, py: number) => {
        const nx = Math.abs((px - cx) / crx);
        const ny = Math.abs((py - cy) / cry);
        return Math.pow(Math.pow(nx, 3) + Math.pow(ny, 3), 1 / 3);
      };

      for (const m of motes) {
        if (!still) m.a += m.sp;
        const px = m.h.x + Math.cos(m.a) * m.r;
        const py = m.h.y + Math.sin(m.a) * m.r * 0.55;
        const d = shape(px, py);
        const keep = d >= 1.75 ? 1 : DIM + (1 - DIM) * Math.max(0, Math.min(1, (d - 0.55) / 1.2));
        ctx.globalAlpha = m.o * keep;
        ctx.fillStyle = tone.get(m.h.tone)!;
        // fillRect, not arc: at 4600 a frame the path cost shows.
        ctx.fillRect(px, py, m.z, m.z);
      }

      // Below the tablet break the hub ring is only a few hundred
      // pixels across, so the labels land on the chips and the lede.
      // The clusters still read; the words are what stop working.
      const labelled = w >= 640;
      ctx.font = '500 10px ui-monospace, SFMono-Regular, monospace';
      ctx.textAlign = 'center';
      for (const hb of hubs) {
        // A label under the nav bar reads as a bug, so the top strip
        // drops them the same way the copy column does.
        if (hb.y < 64) continue;
        const d = shape(hb.x, hb.y);
        const keep = d < 1.05 ? 0 : d < 1.7 ? (d - 1.05) / 0.65 : 1;
        if (keep <= 0.05) continue;
        ctx.globalAlpha = 0.9 * keep;
        ctx.fillStyle = tone.get(hb.tone)!;
        ctx.beginPath();
        ctx.arc(hb.x, hb.y, 3.4 * Math.min(k, 1.6), 0, Math.PI * 2);
        ctx.fill();
        if (!labelled) continue;
        ctx.globalAlpha = 0.66 * keep;
        ctx.fillStyle = label;
        ctx.fillText(hb.label, hb.x, hb.y - 12 * Math.min(k, 1.6));
      }

      if (!still) frame = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      fit();
      if (still) draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`size-full ${className}`} />;
}
