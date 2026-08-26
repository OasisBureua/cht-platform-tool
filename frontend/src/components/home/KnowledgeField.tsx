import { useEffect, useRef } from 'react';

/**
 * A drifting field of motes behind the hero, densest at the centre.
 *
 * Two scales rather than one: mostly small fast motes, plus a sixth as
 * many larger slow ones. A single scale reads as static noise because
 * everything moves at the same apparent rate; the second scale is what
 * makes it read as depth.
 *
 * Canvas, not DOM — a thousand elements each taking a transform every
 * frame would spend the whole budget on style recalculation. The count
 * scales with area so a phone draws a few hundred, not a thousand.
 *
 * Decorative: aria-hidden, and under reduced motion it paints one
 * static frame instead of running a loop.
 */

type Mote = { x: number; y: number; vx: number; vy: number; s: number; o: number };

export function KnowledgeField({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let motes: Mote[] = [];

    const seed = () => {
      const count = Math.max(320, Math.min(1400, Math.round((w * h) / 380)));
      motes = Array.from({ length: count }, () => {
        const a = Math.random() * Math.PI * 2;
        // pow < 1 pulls the distribution inward, so the field thickens
        // toward the middle without drawing a visible disc edge. The
        // radius is taken per axis, not from the short side, or a wide
        // hero leaves the outer thirds empty.
        const r = Math.pow(Math.random(), 0.62);
        const big = Math.random() < 0.06;
        return {
          x: w / 2 + Math.cos(a) * r * w * 0.62,
          y: h / 2 + Math.sin(a) * r * h * 0.72,
          vx: (Math.random() - 0.5) * (big ? 0.07 : 0.17),
          vy: (Math.random() - 0.5) * (big ? 0.07 : 0.17),
          s: big ? 2.2 + Math.random() * 1.8 : 0.6 + Math.random() * 1.4,
          o: (big ? 0.55 : 0.2) + Math.random() * 0.6,
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

    // `--anchor` is the accent that already flips per appearance: a deep
    // blue on the white ground, a bright cyan on the dark one. Reading
    // it each frame means the toggle repaints the field with no listener.
    const accent = () => {
      const t = getComputedStyle(document.documentElement).getPropertyValue('--anchor').trim();
      return t ? `hsl(${t})` : 'hsl(212 100% 38%)';
    };

    let frame = 0;
    const still = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;


    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = accent();
      for (const m of motes) {
        if (!still) {
          m.x += m.vx;
          m.y += m.vy;
          if (m.x < -20) m.x = w + 20;
          else if (m.x > w + 20) m.x = -20;
          if (m.y < -20) m.y = h + 20;
          else if (m.y > h + 20) m.y = -20;
        }
        // Fade on the same normalised ellipse the seeding used, so the
        // field dissolves at its own edge rather than at a circle.
        const nx = (m.x - w / 2) / (w * 0.62);
        const ny = (m.y - h / 2) / (h * 0.72);
        const d = Math.hypot(nx, ny);
        ctx.globalAlpha = m.o * Math.max(0.05, 1 - d * 0.85);
        ctx.fillRect(m.x, m.y, m.s, m.s);
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
