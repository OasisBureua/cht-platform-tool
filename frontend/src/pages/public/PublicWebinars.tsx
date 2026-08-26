import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Clock, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { webinarsApi } from '../../api/webinars';
import { isSessionExpired } from '../../utils/live-session-timing';
import { Card, Chip, Rail, SectionHead } from '../../components/ui';
import { cn } from '../../lib/cn';

type WebinarRow = {
  id: string;
  title: string;
  description: string;
  startTime?: string;
  duration?: number;
  /** Faculty, when the feed carries it. Both fields are optional upstream. */
  hostDisplayName?: string;
  speakers?: string[];
};

/** Bands separate with space, not rules: one gutter, one vertical rhythm. */
function Band({ children }: { children: ReactNode }) {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">{children}</div>
    </section>
  );
}

export default function PublicWebinars() {
  const { data: webinars = [], isLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { upcoming, recent } = useMemo(() => {
    const upcomingList = webinars
      .filter((w) => w.startTime && !isSessionExpired(w.startTime, w.duration))
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime());

    const recentPast = webinars
      .filter((w) => w.startTime && isSessionExpired(w.startTime, w.duration))
      .sort((a, b) => new Date(b.startTime!).getTime() - new Date(a.startTime!).getTime())
      .slice(0, 5);

    return { upcoming: upcomingList, recent: recentPast };
  }, [webinars]);

  const [lead, ...rest] = upcoming;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Masthead ─────────────────────────────────────── */}
      <section>
        <div className="mx-auto max-w-7xl px-4 pt-16 pb-4 sm:px-6 md:pt-24 md:pb-6 lg:px-8">
          <h1 className="text-balance text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.028em] text-foreground sm:text-[3rem]">
            Live
          </h1>
          <p className="mt-5 max-w-[54ch] leading-relaxed text-muted-foreground">
            Live and upcoming sessions: click any webinar to register and join.
          </p>
        </div>
      </section>

      {isLoading ? (
        <Band>
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        </Band>
      ) : upcoming.length === 0 && recent.length === 0 ? (
        <Band>
          <div className="rounded-card bg-card p-12 text-center shadow-card">
            <p className="text-xl font-semibold tracking-[-0.018em] text-foreground">
              No Live sessions available
            </p>
            <p className="mt-2 text-muted-foreground">Check back soon for upcoming sessions.</p>
          </div>
        </Band>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Band>
              <SectionHead index="01 / Sessions" title={`Upcoming · ${upcoming.length}`} />

              {/* The next session leads at full width; the rest browse
                  sideways, so the page has a focal point instead of a
                  uniform stack. */}
              <div className="home-enter mt-10 md:mt-12">
                <LeadSession webinar={lead} />
              </div>

              {rest.length > 0 && (
                <div className="mt-4">
                  <Rail aria-label="More upcoming sessions">
                    {rest.map((w, i) => (
                      <li
                        key={w.id}
                        className="home-enter w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[23%]"
                        style={{ animationDelay: `${60 + i * 60}ms` }}
                      >
                        <SessionCard webinar={w} />
                      </li>
                    ))}
                  </Rail>
                </div>
              )}
            </Band>
          )}

          {recent.length > 0 && (
            <Band>
              <SectionHead
                index={`${upcoming.length > 0 ? '02' : '01'} / Archive`}
                title="Past · last 5"
              />
              <ul className="mt-10 space-y-3 md:mt-12">
                {recent.map((w, i) => (
                  <li
                    key={w.id}
                    className="home-enter"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <PastSession webinar={w} />
                  </li>
                ))}
              </ul>
            </Band>
          )}
        </>
      )}
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────── */

function formatDuration(minutes?: number): string {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Host and speakers read as one faculty line, deduped. */
function facultyOf(w: WebinarRow): string | null {
  const names = [...new Set([w.hostDisplayName, ...(w.speakers ?? [])].filter(Boolean) as string[])];
  return names.length ? names.join(' · ') : null;
}

/**
 * The date is the card's index: a solid square, brand fill while the
 * session is still ahead and muted once it has run. White on brand-600
 * is fixed, because that fill is bright in both appearances.
 */
function DateChip({
  date,
  past = false,
  large = false,
}: {
  date: Date | null;
  past?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-[6px] text-center leading-none',
        large ? 'size-20 md:size-24' : 'size-14',
        past ? 'bg-muted text-muted-foreground' : 'bg-brand-600 text-white',
      )}
    >
      {date ? (
        <span>
          <span
            className={cn(
              'block font-mono text-label uppercase',
              past ? 'text-muted-foreground' : 'text-white/75',
            )}
          >
            {format(date, 'MMM')}
          </span>
          <span
            className={cn(
              'mt-1.5 block font-semibold tabular-nums',
              large ? 'text-3xl md:text-4xl' : 'text-2xl',
            )}
          >
            {format(date, 'd')}
          </span>
        </span>
      ) : (
        <span className="font-mono text-label uppercase">TBD</span>
      )}
    </div>
  );
}

/** Status: how long until it starts, or that it has expired. */
function StatusPill({ date, past }: { date: Date | null; past: boolean }) {
  if (past) return <Chip kind="neutral">Expired</Chip>;
  if (!date) return null;
  return <Chip kind="neutral">{formatDistanceToNow(date, { addSuffix: true })}</Chip>;
}

/** Day, time and length, in figures that cannot jitter between rows. */
function SessionMeta({
  date,
  duration,
  className,
}: {
  date: Date | null;
  duration?: number;
  className?: string;
}) {
  if (!date && !duration) return null;
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-xs tabular-nums text-muted-foreground',
        className,
      )}
    >
      {date && (
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-3.5" />
          {format(date, 'EEE, MMM d, yyyy')}
        </span>
      )}
      {date && (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-3.5" />
          {format(date, 'h:mm a')}
        </span>
      )}
      {duration ? <span>{formatDuration(duration)}</span> : null}
    </div>
  );
}

function LeadSession({ webinar }: { webinar: WebinarRow }) {
  const date = webinar.startTime ? new Date(webinar.startTime) : null;
  const faculty = facultyOf(webinar);

  return (
    <Card to={`/live/${webinar.id}`} className="group p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <DateChip date={date} large />

        <div className="min-w-0 flex-1">
          <StatusPill date={date} past={false} />
          <h3 className="mt-4 text-balance text-xl font-semibold leading-[1.2] tracking-[-0.018em] text-foreground sm:text-2xl">
            {webinar.title}
          </h3>
          {faculty && <p className="mt-2 text-sm text-muted-foreground">{faculty}</p>}
          {webinar.description && (
            <p className="mt-3 line-clamp-2 max-w-[54ch] text-sm leading-relaxed text-muted-foreground">
              {webinar.description}
            </p>
          )}
          <SessionMeta date={date} duration={webinar.duration} className="mt-6" />
        </div>

        <ArrowRight className="hidden size-5 shrink-0 self-center text-muted-foreground transition-transform duration-150 group-hover:translate-x-1 md:block" />
      </div>
    </Card>
  );
}

function SessionCard({ webinar }: { webinar: WebinarRow }) {
  const date = webinar.startTime ? new Date(webinar.startTime) : null;
  const faculty = facultyOf(webinar);

  return (
    <Card to={`/live/${webinar.id}`} className="flex h-full flex-col gap-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <DateChip date={date} />
        <StatusPill date={date} past={false} />
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-2 font-semibold leading-snug tracking-[-0.011em] text-foreground">
          {webinar.title}
        </h3>
        {faculty && <p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{faculty}</p>}
      </div>

      <SessionMeta date={date} duration={webinar.duration} className="mt-auto" />
    </Card>
  );
}

function PastSession({ webinar }: { webinar: WebinarRow }) {
  const date = webinar.startTime ? new Date(webinar.startTime) : null;
  const faculty = facultyOf(webinar);

  return (
    <Card to={`/live/${webinar.id}`} className="group flex items-center gap-4 p-4 sm:gap-5 sm:p-5">
      <DateChip date={date} past />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="min-w-0 truncate font-semibold text-muted-foreground">{webinar.title}</h3>
          <StatusPill date={date} past />
        </div>
        {faculty && <p className="mt-1.5 truncate text-sm text-muted-foreground">{faculty}</p>}
        <SessionMeta date={date} duration={webinar.duration} className="mt-2.5" />
        {webinar.description && (
          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">{webinar.description}</p>
        )}
      </div>

      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-1" />
    </Card>
  );
}
