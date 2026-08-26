import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { webinarsApi, type WebinarItem } from '../../api/webinars';
import { isSessionExpired } from '../../utils/live-session-timing';
import { AbstractFigure, Button, Reveal } from '../../components/ui';
import { cn } from '../../lib/cn';

/** A feed row that survived the date filter, so `startTime` is present. */
type Session = WebinarItem & { startTime: string };

const MONTH = (d: Date) => format(d, 'MMM').toUpperCase();
const DAY = (d: Date) => format(d, 'd');
const prettyDay = (d: Date) => format(d, 'EEE, MMM d, yyyy');

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Host and speakers read as one faculty line, deduped. */
function facultyOf(w: WebinarItem): string | null {
  const names = [...new Set([w.hostDisplayName, ...(w.speakers ?? [])].filter(Boolean) as string[])];
  return names.length ? names.join(' · ') : null;
}

/**
 * Row layout mirrors the platform's own live view: a stacked
 * month/day chip leads, then the title, then the schedule detail,
 * with the status carried in words as well as colour.
 */
function SessionRow({ s, isPast }: { s: Session; isPast: boolean }) {
  const date = new Date(s.startTime);
  const faculty = facultyOf(s);
  const schedule = [format(date, 'h:mm a'), formatDuration(s.duration)].filter(Boolean).join(' · ');

  return (
    <Link
      to={`/live/${s.id}`}
      className="card group grid items-center gap-x-6 gap-y-4 p-5 md:grid-cols-[5rem_1fr_auto_2rem]"
    >
      {/* Date chip. Anchor is a bright fill in dark and a deep one in
          light, so the label takes the ground either way. */}
      <span
        className={cn(
          'grid h-20 w-20 place-items-center rounded-[6px] text-center',
          isPast ? 'bg-surface-2 text-muted2' : 'bg-anchor text-ground',
        )}
      >
        <span>
          <span className="eyebrow block opacity-80">{MONTH(date)}</span>
          <span className="display block text-[1.75rem] leading-none tabular-nums">
            {DAY(date)}
          </span>
        </span>
      </span>

      <span className="min-w-0">
        {/* The design pairs the status with a therapeutic-area label.
            The webinars feed carries no area, so that slot stays on the
            design's own empty branch rather than inventing one. */}
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'eyebrow inline-flex items-center rounded-[6px] px-2.5 py-1',
              isPast ? 'bg-surface-2 text-muted2' : 'bg-cta text-ground',
            )}
          >
            {isPast ? 'Replay' : 'Registration open'}
          </span>
        </span>
        <span className="display mt-2 block text-display-s text-text">{s.title}</span>
        {faculty ? <span className="mt-1 block text-body-s text-muted2">{faculty}</span> : null}
      </span>

      <span className="text-body-s text-muted2 md:text-end">
        <span className="block">{prettyDay(date)}</span>
        {schedule ? <span className="meta mt-1 block text-faint">{schedule}</span> : null}
      </span>

      <ArrowRight
        className="size-4 shrink-0 text-muted2 transition-[translate] duration-150 ease-[var(--ease-standard)] group-hover:translate-x-1 group-hover:text-text"
        strokeWidth={1.75}
      />
    </Link>
  );
}

export default function PublicWebinars() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { next, done } = useMemo(() => {
    // The feed is only trusted once it is actually a list. When the API is
    // unreachable the request resolves against the SPA fallback and hands
    // back an HTML string, which used to take the whole route down with
    // "webinars.filter is not a function" rather than showing the page.
    const rows: WebinarItem[] = Array.isArray(webinars) ? webinars : [];

    // A session with no start time belongs to neither list: it cannot be
    // placed on the schedule and cannot be judged expired.
    const dated = rows.filter((w): w is Session => Boolean(w.startTime));

    return {
      next: dated
        .filter((w) => !isSessionExpired(w.startTime, w.duration))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
      done: dated
        .filter((w) => isSessionExpired(w.startTime, w.duration))
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, 5),
    };
  }, [webinars]);

  return (
    <div className="min-h-screen bg-ground">
      <section className="rail pt-14 pb-12 md:pt-16 md:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
          <div>
            <p className="eyebrow text-muted2">Live</p>
            <h1 className="display mt-6 max-w-[16ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
              Live and upcoming sessions
            </h1>
            <p className="prose-lede mt-6 max-w-[50ch] text-body-l text-muted2">
              Click any session to register and join. Replays are chaptered and filed under their
              disease state within a week.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {/* With nothing on the schedule the design sends people to
                  the library instead, so the empty feed needs no separate
                  treatment. */}
              <Button to={next.length ? `/live/${next[0].id}` : '/catalog'} variant="cta">
                {next.length ? 'Register for the next session' : 'Browse the library'}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
              <Button to="/chm-office-hours" variant="outline">
                CHM Office Hours
              </Button>
            </div>
          </div>

          <AbstractFigure variant="broadcast" />
        </div>
      </section>

      {isLoading ? (
        <div className="rail flex justify-center pb-24">
          <Loader2 aria-label="Loading sessions" className="size-8 animate-spin text-faint" />
        </div>
      ) : (
        <>
          {next.length > 0 ? (
            <section aria-labelledby="upcoming-heading" className="rail pb-14">
              <h2 id="upcoming-heading" className="eyebrow text-faint">
                Upcoming · {next.length}
              </h2>
              <ul className="mt-5 space-y-3">
                {next.map((s, i) => (
                  <Reveal as="li" key={s.id} delay={i * 50}>
                    <SessionRow s={s} isPast={false} />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}

          {done.length > 0 ? (
            <section aria-labelledby="past-heading" className="rail pb-24">
              <h2 id="past-heading" className="eyebrow text-faint">
                Past · last {done.length}
              </h2>
              <ul className="mt-5 space-y-3">
                {done.map((s, i) => (
                  <Reveal as="li" key={s.id} delay={i * 50}>
                    <SessionRow s={s} isPast />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
