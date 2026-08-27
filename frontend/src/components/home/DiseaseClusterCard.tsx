import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

/**
 * A disease state as a cluster: the hero map at a second zoom.
 *
 * Density tracks how much the area actually holds, so an area with no
 * library yet renders a thin, faded cluster and one with a full library
 * renders a dense one. The picture tells the truth about volume, which
 * is what the gradient tiles could not do — they gave an empty shelf
 * the same visual weight as a full one and then had to write "coming
 * this quarter" across it.
 *
 * The loop is gated on visibility. Between the hero map, the pipeline
 * and seven of these, one page can carry nine canvases; running every
 * one of them while they sit below the fold is a cost with no viewer.
 */

type Mote = { a: number; r: number; sp: number; o: number; z: number };

export function DiseaseClusterCard({
  label,
  sub,
  tone,
  weight,
  to,
}: {
  label: string;
  sub: string;
  /** A CSS colour, or a `--token` name resolved per appearance. */
  tone: string;
  /** 0 to 1. Drives how many motes the cluster carries. */
  weight: number;
  to?: string;
}) {
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
      // Floor of 260 so an area with no library still reads as a
      // cluster rather than a smudge; a full one roughly triples it.
      const n = Math.round(260 + Math.max(0, Math.min(1, weight)) * 700);
      motes = Array.from({ length: n }, () => {
        const b = Math.random();
        return {
          a: Math.random() * Math.PI * 2,
          r: b < 0.4 ? 5 + Math.random() * 20 : b < 0.75 ? 22 + Math.random() * 28 : 46 + Math.random() * 40,
          sp: (b < 0.4 ? 0.0038 : 0.0018) + Math.random() * 0.0024,
          o: (b < 0.4 ? 0.72 : 0.36) + Math.random() * 0.4,
          z: b < 0.4 ? 2.6 : 1.9,
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

    const colour = () => {
      if (!tone.startsWith('--')) return tone;
      const t = getComputedStyle(document.documentElement).getPropertyValue(tone).trim();
      return t ? `hsl(${t})` : 'hsl(212 100% 38%)';
    };

    let frame = 0;
    let onScreen = true;
    const still = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colour();
      // Off-centre and high, so the cluster sits clear of the label.
      const cx = w * 0.74;
      const cy = h * 0.32;
      for (const m of motes) {
        if (!still) m.a += m.sp;
        ctx.globalAlpha = m.o;
        ctx.fillRect(cx + Math.cos(m.a) * m.r, cy + Math.sin(m.a) * m.r * 0.7, m.z, m.z);
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
  }, [tone, weight]);

  const body = (
    <>
      <canvas ref={ref} aria-hidden className="absolute inset-0 size-full" />
      <span className="relative">
        <span className="display block text-body-m text-text">{label}</span>
        <span className="mt-1 block text-body-s text-muted2">{sub}</span>
      </span>
    </>
  );

  const shell =
    'card relative flex h-40 w-60 shrink-0 snap-start flex-col justify-end overflow-hidden p-4';

  // An area with no library yet is not a link. It still shows, because
  // the queue is worth seeing; it just does not pretend to go anywhere.
  return to ? (
    <Link
      to={to}
      className={`${shell} lift press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor`}
    >
      {body}
    </Link>
  ) : (
    // Not a link, but not dimmed either: the density already says the
    // area is thin, and a blanket 60% was washing the hue out with it.
    <div className={shell}>{body}</div>
  );
}
