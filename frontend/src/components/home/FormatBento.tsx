import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Pipeline } from './Pipeline';
import { Thumb } from '../ui/Thumb';

/**
 * The formats section as a bento: everything at rest, nothing behind a
 * click. The window version proves the formats are one document by
 * making you switch; this proves it by showing them together.
 *
 * Row one is the three cuts of a single session. Row two widens out to
 * the two things that are not a recording at all — the live sessions,
 * and the network the sessions come from.
 *
 * The format cards animate continuously. Gating them on hover was
 * wrong twice over: a touch screen never hovers, so on a phone both
 * cards were simply dead, and the point of the row is that you can see
 * all three formats at once without touching anything.
 *
 * Reduced motion still stops them.
 */

const ARTICLE = [
  'Recurrence remains a clinically important challenge in high-risk HER2-positive early breast cancer.',
  'Trastuzumab-based therapy improved long-term survival, but some patients still recur after standard adjuvant treatment.',
  'Extended adjuvant therapy was designed for exactly that gap: sustained inhibition after standard therapy completes.',
  'The benefit concentrates in those who begin within a year of finishing trastuzumab.',
];

const CHAPTERS: [string, string][] = [
  ['00:00', 'The case'],
  ['03:12', 'What the registrational data says'],
  ['08:40', 'Where the guidelines lag'],
];

/**
 * Card labels in the brand guide's colours: Knowledge Blue, Amber and
 * Deep Expertise, with Amber on Live as the guide reserves it. Each is
 * the deepest tone of its hue that clears 4.5:1 as 11px text on the
 * white card; the guide's own amber and Knowledge Blue sit at 1.9:1 and
 * 2.6:1 there.
 */
const LABEL_TONE = {
  blue: 'hsl(193 63% 35%)',
  amber: 'hsl(37 91% 32%)',
  deep: 'hsl(196 66% 23%)',
} as const;

function Card({
  label,
  meta,
  title,
  body,
  to,
  tone,
  className = '',
  height = 'h-[21.25rem]',
  span = 'md:col-span-4',
  children,
}: {
  label: string;
  meta: string;
  title: string;
  body: string;
  to: string;
  /** Label colour, from LABEL_TONE. */
  tone: string;
  className?: string;
  /** Fixed, so one card's content cannot set every sibling's height. */
  height?: string;
  /** Column span on the twelve-column row. */
  span?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`group card lift press flex flex-col overflow-hidden p-4 ${height} ${span} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow" style={{ color: tone }}>
          {label}
        </span>
        <span className="meta tabular-nums text-faint">{meta}</span>
      </div>
      <div className="my-3 min-h-0 flex-1 overflow-hidden">{children}</div>
      <div>
        <p className="display text-body-m text-text">{title}</p>
        <p className="prose-lede mt-1 text-body-s text-muted2">{body}</p>
      </div>
    </Link>
  );
}

/**
 * The audio cut: flowing line traces rather than a bar meter, ported
 * from the CHM WordPress theme. Forty-two thin curves, each a sum of two
 * sines under a travelling envelope, so the field gathers into packets
 * and thins out between them.
 *
 * Two colour families, warm and cool, interpolated separately and
 * interleaved. A single ramp from amber (37) to coral (359) walks the
 * hue wheel the long way round and comes out magenta.
 */
function Wave() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const LINES = 42;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const WARM = [[37, 91, 55], [14, 74, 52]] as const; // amber to rust
    const COOL = [[193, 63, 49], [196, 66, 32]] as const; // knowledge blue to deep expertise
    let w = 0;
    let h = 0;
    let frame = 0;
    let pending = 0;
    let onScreen = true;
    let phase = 0;
    let disposed = false;

    const fit = () => {
      const r = cv.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.max(1, Math.round(r.width * dpr));
      cv.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      w = r.width;
      h = r.height;
    };

    const traceColour = (i: number) => {
      // A slow sine clumps the families instead of hard-alternating them.
      const [a, b] = Math.sin(i * 0.62) > 0.1 ? COOL : WARM;
      const u = (Math.sin(i * 1.7) + 1) / 2;
      const m = (k: number) => a[k] + (b[k] - a[k]) * u;
      return `hsl(${m(0).toFixed(1)} ${m(1).toFixed(1)}% ${m(2).toFixed(1)}%)`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < LINES; i++) {
        const t = i / (LINES - 1);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 2) {
          const u = x / w;
          // Envelope: three travelling packets across the width.
          const env = Math.pow(Math.abs(Math.sin(u * Math.PI * 3.1 + phase * 0.35)), 1.7) * 0.86 + 0.14;
          const y =
            h / 2 +
            Math.sin(u * 15 + i * 0.19 + phase) * h * 0.2 * env +
            Math.sin(u * 27 - i * 0.31 - phase * 1.4) * h * 0.13 * env +
            (t - 0.5) * h * 0.5 * env;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = traceColour(i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (!disposed && !still && onScreen) {
        phase += 0.006;
        frame = requestAnimationFrame(draw);
      }
    };

    fit();
    draw();

    const io = new IntersectionObserver(
      ([e]) => {
        if (disposed || e.isIntersecting === onScreen) return;
        onScreen = e.isIntersecting;
        if (onScreen) draw();
        else cancelAnimationFrame(frame);
      },
      { rootMargin: '120px' },
    );
    io.observe(cv);

    const onResize = () => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        if (disposed) return;
        fit();
        if (still) draw();
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(pending);
      io.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="block h-full w-full" aria-hidden />;
}

/** The written cut, drifting under a fade at both edges. */
function Drift() {
  return (
    <div
      className="relative h-full overflow-hidden"
      aria-hidden
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 14%, black 76%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to bottom, transparent, black 14%, black 76%, transparent)',
      }}
    >
      <div className="motion-safe:animate-[editorial-drift_22s_linear_infinite]">
        {[0, 1].map((pass) => (
          <div key={pass}>
            {ARTICLE.map((line, i) => (
              <p key={`${pass}-${i}`} className="pb-3 text-[0.8125rem] leading-relaxed text-muted2">
                {line}
              </p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormatBento({ poster }: { poster: string }) {
  // Twelve columns, not three: row one is 4+4+4, but row two splits
  // 7+5 so the Live card stops short of the format cards' right edge
  // instead of running the full two-thirds.
  return (
    <div className="mt-12 grid gap-4 md:grid-cols-12">
      <Card
        label="Video"
        tone={LABEL_TONE.blue}
        meta="18:40"
        title="The long-form conversation"
        body="Two clinicians work a case end to end."
        to="/catalog"
      >
        <div className="flex h-full flex-col">
          <Thumb src={poster} className="aspect-video w-full" />
          <ol className="mt-3 min-h-0 flex-1 overflow-hidden">
            {CHAPTERS.map(([t, label]) => (
              <li key={t} className="flex items-center gap-3 py-1">
                <span className="meta w-11 shrink-0 tabular-nums text-anchor">{t}</span>
                <span className="truncate text-[0.8125rem] text-muted2">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </Card>

      <Card
        label="Podcast"
        tone={LABEL_TONE.amber}
        meta="34:02"
        title="The audio cut"
        body="The same conversation, for the commute."
        to="/podcast-network"
      >
        <Wave />
      </Card>

      <Card
        label="Editorial"
        tone={LABEL_TONE.deep}
        meta="6 min"
        title="The written explainer"
        body="What changed, and what it changes."
        to="/catalog"
      >
        <Drift />
      </Card>

      {/* Row two: the two things that are not a cut of a recording. */}
      <Card
        label="Live"
        tone={LABEL_TONE.amber}
        meta="Next: 4 Sep"
        title="Office Hours"
        body="Send the case you are stuck on. Two faculty work it live, without the answer in advance."
        to="/live"
        height="h-[15rem]"
        span="md:col-span-7"
      >
        <div className="flex h-full items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-[6px] bg-anchor text-center text-ground">
            <span>
              <span className="eyebrow block opacity-80">SEP</span>
              <span className="display block text-[1.25rem] leading-none tabular-nums">4</span>
            </span>
          </span>
          <ul className="min-w-0 flex-1 space-y-2">
            {[
              ['Implementing DESTINY-Breast11 in practice', '4:00 PM ET'],
              ['Managing the AKT pathway in second line', '11 Sep'],
            ].map(([t, when]) => (
              <li key={t} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-dim">{t}</span>
                <span className="meta shrink-0 tabular-nums text-faint">{when}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card
        label="For clinicians"
        tone={LABEL_TONE.blue}
        meta="Free"
        title="The HCP platform"
        body="Every session, every format, filed by disease state. Free, and it stays free."
        to="/for-hcps"
        height="h-[15rem]"
        span="md:col-span-5"
      >
        {/* The bars carried no meaning. This is the platform's actual
            claim: one recording in, every format out, filed. */}
        <Pipeline />
      </Card>
    </div>
  );
}
