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
 * The pointer is a lens. At rest the field is one accent; inside
 * `REACH` the motes take the full spectrum, weighted by an inverse
 * square falloff so the effect has no edge. Each mote is assigned its
 * hue once at seed time, so the colour travels with the particle
 * rather than staying pinned to the region — drag the pointer and you
 * drag a coloured wake behind it.
 *
 * Decorative: aria-hidden, no pointer effect without a fine pointer
 * (a touch screen has no hover, and a stuck last-touch position reads
 * as broken), and under reduced motion it paints one static frame.
 */

type Mote = { x: number; y: number; vx: number; vy: number; s: number; o: number; k: number };

/** Deep in the light appearance, bright in the dark one. */
const TONES = ['--ink-pink', '--ink-purple', '--anchor', '--ink-cyan', '--ink-coral', '--ink-green'];

/** How far the pointer's influence reaches, in CSS pixels. */
const REACH = 260;

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
      const count = Math.max(600, Math.min(2600, Math.round((w * h) / 190)));
      motes = Array.from({ length: count }, (_, i) => {
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
          vx: (Math.random() - 0.5) * (big ? 0.084 : 0.204),
          vy: (Math.random() - 0.5) * (big ? 0.084 : 0.204),
          s: big ? 2.64 + Math.random() * 2.16 : 0.72 + Math.random() * 1.68,
          o: (big ? 0.55 : 0.2) + Math.random() * 0.6,
          k: i % TONES.length,
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

    // Reading the tokens each frame means the appearance toggle
    // repaints the field with no listener of its own.
    const read = (name: string) => {
      const t = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return t ? `hsl(${t})` : 'hsl(212 100% 38%)';
    };

    // Only a real pointer gets the lens.
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    let mx = -9999;
    let my = -9999;

    // The listener goes on the window, not the canvas: the hero's
    // backdrop is `pointer-events-none` so the copy above it stays
    // selectable, which means the canvas itself never sees a move. The
    // rect is cached and refreshed on scroll and resize rather than
    // read per event, so moving the mouse does not thrash layout.
    let box = cv.getBoundingClientRect();
    const remeasure = () => {
      box = cv.getBoundingClientRect();
    };
    const onMove = (e: PointerEvent) => {
      const x = e.clientX - box.left;
      const y = e.clientY - box.top;
      const out = x < -REACH || y < -REACH || x > box.width + REACH || y > box.height + REACH;
      mx = out ? -9999 : x;
      my = out ? -9999 : y;
    };
    if (fine) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('scroll', remeasure, { passive: true });
    }

    let frame = 0;
    const still = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;


    // Reused every frame so the hot loop allocates nothing.
    const lit: number[][] = TONES.map(() => []);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = read('--anchor');
      for (const q of lit) q.length = 0;

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
        const a = m.o * Math.max(0.05, 1 - Math.hypot(nx, ny) * 0.85);

        let infl = 0;
        if (mx > -9998) {
          const d = Math.hypot(m.x - mx, m.y - my);
          if (d < REACH) {
            // Ease-out, not squared. Squaring collapses the lit zone to
            // a point and the recolour never reads; this holds a wide
            // plateau under the pointer and falls off at the rim.
            const t = 1 - d / REACH;
            infl = t * (2 - t);
          }
        }

        // The base pass paints at the complement of the influence; the
        // lit ones are collected so pass two sets fillStyle six times
        // rather than once per mote.
        if (infl < 1) {
          ctx.globalAlpha = a * (1 - infl);
          ctx.fillRect(m.x, m.y, m.s, m.s);
        }
        // The lit motes are drawn brighter and a little larger than
        // their base state: the pointer should read as a light passing
        // over the field, not as a swatch swap at matched weight.
        if (infl > 0) {
          lit[m.k].push(m.x, m.y, m.s * (1 + 0.55 * infl), Math.min(1, a * infl * 2.4));
        }
      }

      for (let k = 0; k < TONES.length; k += 1) {
        const q = lit[k];
        if (!q.length) continue;
        ctx.fillStyle = read(TONES[k]);
        for (let j = 0; j < q.length; j += 4) {
          ctx.globalAlpha = q[j + 3];
          ctx.fillRect(q[j], q[j + 1], q[j + 2], q[j + 2]);
        }
      }

      if (!still) frame = requestAnimationFrame(draw);
    };
    draw();

    const onResize = () => {
      fit();
      remeasure();
      if (still) draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', remeasure);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`size-full ${className}`} />;
}
