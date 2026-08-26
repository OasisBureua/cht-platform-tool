import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
 * Only the card under the pointer animates. Five ambient motions at
 * once is noise, and on a touch screen nothing hovers, so each card
 * still reads at rest.
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

function Card({
  label,
  meta,
  title,
  body,
  to,
  accent,
  className = '',
  children,
}: {
  label: string;
  meta: string;
  title: string;
  body: string;
  to: string;
  accent?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={`group card lift press flex min-h-[17rem] flex-col p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-anchor ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className={`eyebrow ${accent ? 'text-amber' : 'text-faint'}`}>{label}</span>
        <span className="meta tabular-nums text-faint">{meta}</span>
      </div>
      <div className="my-4 min-h-0 flex-1">{children}</div>
      <div>
        <p className="display text-body-m text-text">{title}</p>
        <p className="prose-lede mt-1 text-body-s text-muted2">{body}</p>
      </div>
    </Link>
  );
}

/** The audio cut. Runs only while the card is hovered or focused. */
function Wave() {
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!live || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 220);
    return () => window.clearInterval(id);
  }, [live]);

  const bars = Array.from(
    { length: 26 },
    (_, i) => 22 + Math.abs(Math.sin(i * 0.7 + tick * 0.35)) * 72,
  );

  return (
    <div
      className="flex h-full items-end gap-[3px]"
      aria-hidden
      onPointerEnter={() => setLive(true)}
      onPointerLeave={() => setLive(false)}
    >
      {bars.map((h, i) => (
        <span
          key={i}
          style={{ height: `${h}%` }}
          className="w-full rounded-[6px] bg-amber/45 transition-[height] duration-200 ease-out"
        />
      ))}
    </div>
  );
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
      <div className="motion-safe:group-hover:animate-[editorial-drift_22s_linear_infinite]">
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
  return (
    <div className="mt-12 grid gap-4 md:grid-cols-3">
      <Card
        label="Video"
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
        meta="34:02"
        title="The audio cut"
        body="The same conversation, for the commute."
        to="/podcasts"
        accent
      >
        <Wave />
      </Card>

      <Card
        label="Editorial"
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
        meta="Next: 4 Sep"
        title="Office Hours"
        body="Send the case you are stuck on. Two faculty work it live, without the answer in advance."
        to="/live"
        className="md:col-span-2"
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
        label="Network"
        meta="4 shows"
        title="CHM Podcast Network"
        body="Four shows, each with its own voice and its own audience."
        to="/podcasts"
      >
        <div className="flex h-full items-end gap-2">
          {[
            'var(--color-pink)',
            'var(--color-cyan)',
            'var(--color-purple)',
            'var(--color-coral)',
          ].map((tone, i) => (
            <span
              key={i}
              className="flex-1 rounded-[6px] transition-[height] duration-300 ease-out"
              style={{ background: tone, height: `${52 + i * 14}%`, opacity: 0.85 }}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
