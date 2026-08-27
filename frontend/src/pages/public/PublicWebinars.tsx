import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { format, isToday } from 'date-fns';
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

  const { today, upcoming } = useMemo(() => {
    // The feed is only trusted once it is actually a list. When the API is
    // unreachable the request resolves against the SPA fallback and hands
    // back an HTML string, which used to take the whole route down with
    // "webinars.filter is not a function" rather than showing the page.
    const rows: WebinarItem[] = Array.isArray(webinars) ? webinars : [];

    // A session with no start time belongs to neither list: it cannot be
    // placed on the schedule and cannot be judged expired.
    const dated = rows.filter((w): w is Session => Boolean(w.startTime));

    // Past sessions are deliberately not shown. A live page that opens
    // with what already happened reads as an archive; replays belong in
    // the library, filed under their disease state.
    const live = dated
      .filter((w) => !isSessionExpired(w.startTime, w.duration))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return {
      today: live.filter((w) => isToday(new Date(w.startTime))),
      upcoming: live.filter((w) => !isToday(new Date(w.startTime))),
    };
  }, [webinars]);

  const nextUp = today[0] ?? upcoming[0];

  return (
    <div className="min-h-screen bg-ground">
      <section className="rail pt-14 pb-12 md:pt-16 md:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.02fr] lg:gap-16">
          <div>
            <p className="eyebrow text-muted2">Live</p>
            <h1 className="display mt-6 max-w-[18ch] text-[2.5rem] leading-[1.04] tracking-[-0.03em] text-text md:text-display-l">
              Ask the faculty, while the case is still open
            </h1>
            <p className="prose-lede mt-6 max-w-[52ch] text-body-l text-muted2">
              Every session is two clinicians working a real case in front of you, without the
              answer agreed in advance. Bring the one you are stuck on. Registration is free and
              takes an account, so we know who is in the room.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {/* With nothing on the schedule the page sends people to the
                  library instead, so an empty feed needs no separate
                  treatment. */}
              <Button to={nextUp ? `/live/${nextUp.id}` : '/join'} variant="cta">
                {nextUp ? 'Register for the next session' : 'Create a free account'}
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </Button>
              <Button to="/catalog" variant="outline">
                Browse past replays
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
          {today.length > 0 ? (
            <section aria-labelledby="today-heading" className="rail pb-12">
              <h2 id="today-heading" className="eyebrow text-ink-coral">
                Today · {today.length}
              </h2>
              <ul className="mt-5 space-y-3">
                {today.map((s, i) => (
                  <Reveal as="li" key={s.id} delay={i * 50}>
                    <SessionRow s={s} isPast={false} />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section aria-labelledby="upcoming-heading" className="rail pb-14">
              <h2 id="upcoming-heading" className="eyebrow text-faint">
                Upcoming · {upcoming.length}
              </h2>
              <ul className="mt-5 space-y-3">
                {upcoming.map((s, i) => (
                  <Reveal as="li" key={s.id} delay={i * 50}>
                    <SessionRow s={s} isPast={false} />
                  </Reveal>
                ))}
              </ul>
            </section>
          ) : null}

          {today.length === 0 && upcoming.length === 0 ? (
            <section className="rail pb-14">
              <div className="rounded-[8px] bg-surface px-8 py-14 text-center shadow-card">
                <p className="display text-display-s text-text">Nothing on the schedule yet</p>
                <p className="prose-lede mx-auto mt-3 max-w-[42ch] text-body-m text-muted2">
                  New sessions are announced a fortnight ahead. An account puts them in front of
                  you as they are scheduled.
                </p>
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* ── What a session actually is ─────────────────── */}
      <section aria-labelledby="how-heading" className="rail pb-16">
        <h2 id="how-heading" className="display text-display-m text-text">
          How a session runs
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            [
              'You send the case',
              'Registration asks what you are stuck on. The faculty see the questions before they go on, and the ones that come up most set the running order.',
            ],
            [
              'Two clinicians work it live',
              'No slides agreed in advance and no single right answer. Where they disagree, they say so, which is usually the most useful part.',
            ],
            [
              'It is filed within a week',
              'Chaptered, transcribed and filed under its disease state, so the answer is findable long after the room empties.',
            ],
          ].map(([title, body]) => (
            <div key={title} className="card p-6">
              <p className="display text-body-m text-text">{title}</p>
              <p className="prose-lede mt-2 text-body-s text-muted2">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free, and it stays free ────────────────────── */}
      <section aria-labelledby="join-heading" className="rail pb-24">
        <div className="flex flex-col gap-6 rounded-[8px] bg-surface px-8 py-12 shadow-card md:flex-row md:items-center md:justify-between md:px-12">
          <div>
            <h2 id="join-heading" className="display text-display-m text-text">
              Free for clinicians
            </h2>
            <p className="prose-lede mt-3 max-w-[46ch] text-body-m text-muted2">
              An account is what lets us seat the room and send the replay. It stays free.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button to="/join" variant="cta">
              Create an account
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </Button>
            <Button to="/for-hcps" variant="outline">
              What you get
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
