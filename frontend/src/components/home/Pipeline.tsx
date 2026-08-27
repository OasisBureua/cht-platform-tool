import { useEffect, useRef } from 'react';

/**
 * One stream in, three formats out.
 *
 * The operational claim the platform card is making, drawn rather than
 * described: a single grey inflow splits at a junction and leaves down
 * three coloured lanes. It replaced a row of coloured bars that carried
 * no meaning at all.
 *
 * Decorative, so aria-hidden; under reduced motion the particles hold
 * position and only the lanes read.
 *
 * The loop is gated on visibility. Between the hero map, the pipeline
 * and seven of these, one page can carry nine canvases; running every
 * one of them while they sit below the fold is a cost with no viewer.
 */

type Dot = { t: number; lane: -1 | 0 | 1; sp: number; o: number };

const LANES: (-1 | 0 | 1)[] = [-1, 0, 1];

export function Pipeline({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dots: Dot[] = Array.from({ length: 120 }, (_, i) => ({
      t: Math.random(),
      lane: LANES[i % 3],
      sp: 0.0022 + Math.random() * 0.003,
      o: 0.3 + Math.random() * 0.7,
    }));

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = r.width;
      h = r.height;
    };
    fit();

    const read = (name: string, fallback: string) => {
      const t = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return t ? `hsl(${t})` : fallback;
    };

    let frame = 0;
    let onScreen = true;
    const still = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const out = [
        read('--ink-purple', 'hsl(259 55% 49%)'),
        read('--ink-pink', 'hsl(314 72% 38%)'),
        read('--anchor', 'hsl(212 100% 38%)'),
      ];
      const grey = read('--faint', 'hsl(30 5% 40%)');

      const inX = w * 0.06;
      const splitX = w * 0.4;
      const outX = w * 0.97;
      const c1 = splitX + 40;
      const c2 = outX - 56;

      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = grey;
      ctx.lineWidth = 1;
      for (const lane of LANES) {
        const y2 = h / 2 + lane * h * 0.34;
        ctx.beginPath();
        ctx.moveTo(inX, h / 2);
        ctx.lineTo(splitX, h / 2);
        ctx.bezierCurveTo(c1, h / 2, c2, y2, outX, y2);
        ctx.stroke();
      }

      for (const d of dots) {
        if (!still) {
          d.t += d.sp;
          if (d.t > 1) d.t = 0;
        }
        let px: number;
        let py: number;
        if (d.t < 0.4) {
          // The shared inflow: everything is one recording up to here.
          px = inX + (splitX - inX) * (d.t / 0.4);
          py = h / 2;
        } else {
          const u = (d.t - 0.4) / 0.6;
          const y2 = h / 2 + d.lane * h * 0.34;
          const m = 1 - u;
          px = m * m * m * splitX + 3 * m * m * u * c1 + 3 * m * u * u * c2 + u * u * u * outX;
          py = m * m * m * (h / 2) + 3 * m * m * u * (h / 2) + 3 * m * u * u * y2 + u * u * u * y2;
        }
        ctx.globalAlpha = d.o * (d.t < 0.4 ? 0.5 : 0.95);
        ctx.fillStyle = d.t < 0.4 ? grey : out[d.lane + 1];
        ctx.beginPath();
        ctx.arc(px, py, d.t < 0.4 ? 1.3 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!still && onScreen) frame = requestAnimationFrame(draw);
    };
    draw();

    const io = new IntersectionObserver(
      ([entry]) => {
        const next = entry.isIntersecting;
        if (next === onScreen) return;
        onScreen = next;
        // Restart the loop on re-entry; cancel it on the way out.
        if (onScreen) draw();
        else cancelAnimationFrame(frame);
      },
      { rootMargin: '120px' },
    );
    io.observe(cv);

    const onResize = () => {
      fit();
      if (still) draw();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`size-full ${className}`} />;
}
