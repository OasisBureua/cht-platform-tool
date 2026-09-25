import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  PlayCircle,
  Presentation,
  Search,
  Zap,
} from 'lucide-react';
import { webinarsApi } from '../api/webinars';
import { programsApi } from '../api/programs';
import { useAuth } from '../contexts/AuthContext';
import { liveSessionListBadgeLabel } from '../utils/live-session-list-badge';
import { catalogApi, type ContentHubClip } from '../api/catalog';
import { getShortClipId, getContentHubThumbnail, shouldSurfaceCatalogClip } from '../utils/clipUrl';
import { clipStripeSubtitle } from '../utils/contentHubClipText';
import { surveysApi } from '../api/surveys';

const FALLBACK_IMAGES = {
  webinar: '/images/iStock-2230313942-1a0d8644-fc61-4713-972b-53ca638c2a21.png',
  clip: '/images/iStock-2216489570-5b943c5f-1d37-435a-a309-e39b12f434e0.png',
  survey: '/images/iStock-2233342016-12339015-cb72-4731-bdc1-219dc4810191.png',
} as const;

type Tab = 'best' | 'webinars' | 'videos' | 'surveys';

type UnifiedItem =
  | {
      type: 'webinar';
      id: string;
      programId: string;
      registrationRequiresApproval?: boolean;
      title: string;
      description: string;
      imageUrl: string;
      href: string;
    }
  | {
      type: 'clip';
      id: string;
      title: string;
      description: string;
      imageUrl: string;
      href: string;
      subtitle?: string;
    }
  | {
      type: 'survey';
      id: string;
      title: string;
      description: string;
      imageUrl: string;
      href: string;
    };

function matchesQuery(item: UnifiedItem, q: string): boolean {
  if (!q) return true;
  const lower = q.trim().toLowerCase();
  if (!lower) return true;
  const title = (item.title ?? '').toLowerCase();
  const desc = (item.description ?? '').toLowerCase();
  const sub =
    item.type === 'clip' && item.subtitle ? item.subtitle.toLowerCase() : '';
  return title.includes(lower) || desc.includes(lower) || sub.includes(lower);
}

const fieldClass =
  'h-11 w-full rounded-[6px] border border-border bg-card pl-10 pr-3 text-sm text-foreground outline-none ' +
  'placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-steel-500/30';

/**
 * In-app Search (`/app/search`) — catalog + live + surveys, styled like
 * KOL Network / LIVE (icon title, filter card, chip tabs, result cards).
 */
export default function ExploreOpportunities() {
  const { user } = useAuth();
  const userId = user?.userId;
  const id = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQ);
  const [debouncedQuery, setDebouncedQuery] = useState(urlQ.trim());
  const [tab, setTab] = useState<Tab>('best');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setQuery(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const next = debouncedQuery;
    const current = searchParams.get('q') ?? '';
    if (next === current) return;
    const params = new URLSearchParams(searchParams);
    if (next) params.set('q', next);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  }, [debouncedQuery, searchParams, setSearchParams]);

  const { data: webinars = [], isLoading: webinarsLoading } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: liveStatuses = [] } = useQuery({
    queryKey: ['programs', 'me', 'live-session-status'],
    queryFn: () => programsApi.getMyLiveSessionStatus(),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const statusByProgramId = useMemo(() => {
    const m = new Map<string, (typeof liveStatuses)[0]>();
    for (const s of liveStatuses) m.set(s.programId, s);
    return m;
  }, [liveStatuses]);

  // Always hit catalog search/clips — do not gate on /tags (that broke search
  // whenever the tags probe was empty or still loading).
  const {
    data: clipsData,
    isLoading: clipsLoading,
    isError: clipsError,
  } = useQuery({
    queryKey: ['catalog', 'app-search', debouncedQuery],
    queryFn: () => {
      if (debouncedQuery.length >= 2) {
        return catalogApi.search(debouncedQuery, { limit: 40 });
      }
      return catalogApi.getClips({
        limit: 24,
        offset: 0,
        sort_by: 'recorded_at',
      });
    },
    staleTime: 2 * 60 * 1000,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const { data: surveyList, isLoading: surveysLoading } = useQuery({
    queryKey: ['surveys', userId],
    queryFn: surveysApi.getAll,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
  const surveys = surveyList?.active ?? [];

  const items = useMemo((): UnifiedItem[] => {
    const out: UnifiedItem[] = [];

    webinars.forEach((w) => {
      out.push({
        type: 'webinar',
        id: `webinar-${w.id}`,
        programId: w.id,
        registrationRequiresApproval: w.registrationRequiresApproval,
        title: w.title,
        description: w.description || '',
        imageUrl: w.imageUrl || '',
        href: `/app/live/${w.id}`,
      });
    });

    const validClips = (clipsData?.items ?? []).filter(
      (c) => c && (c.id || c.title) && shouldSurfaceCatalogClip(c as ContentHubClip),
    );
    validClips.forEach((c) => {
      out.push({
        type: 'clip',
        id: `clip-${c.id ?? ''}`,
        title: c.title ?? '',
        description: clipStripeSubtitle(c),
        imageUrl: getContentHubThumbnail(c) || FALLBACK_IMAGES.clip,
        href: `/app/clip/${getShortClipId(c.id ?? '')}`,
        subtitle: c.doctors?.length ? c.doctors.join(', ') : undefined,
      });
    });

    surveys.forEach((s) => {
      out.push({
        type: 'survey',
        id: `survey-${s.id}`,
        title: s.title || s.program?.title || 'Survey',
        description: s.description || '',
        imageUrl: '',
        href: `/app/surveys/${s.id}`,
      });
    });

    return out;
  }, [webinars, clipsData, surveys]);

  const filtered = useMemo(() => {
    const q = debouncedQuery;
    // Server already filtered clips when q >= 2; still filter live/surveys client-side.
    const apiFilteredClips = q.length >= 2;
    let list = items.filter((item) => {
      if (apiFilteredClips && item.type === 'clip') return true;
      return matchesQuery(item, q);
    });

    if (tab === 'webinars') list = list.filter((i) => i.type === 'webinar');
    else if (tab === 'videos') list = list.filter((i) => i.type === 'clip');
    else if (tab === 'surveys') list = list.filter((i) => i.type === 'survey');

    return list;
  }, [items, debouncedQuery, tab]);

  const isLoading = webinarsLoading || surveysLoading || clipsLoading;
  const showClipsError = clipsError && debouncedQuery.length >= 2;

  const tabs: { key: Tab; label: string; icon: typeof Zap }[] = [
    { key: 'best', label: 'Best match', icon: Zap },
    { key: 'webinars', label: 'Live', icon: Presentation },
    { key: 'videos', label: 'Videos', icon: PlayCircle },
    { key: 'surveys', label: 'Surveys', icon: ClipboardList },
  ];

  const counts = useMemo(
    () => ({
      best: filtered.length,
      webinars: items.filter((i) => i.type === 'webinar' && matchesQuery(i, debouncedQuery)).length,
      videos: items.filter((i) => i.type === 'clip').length,
      surveys: items.filter((i) => i.type === 'survey' && matchesQuery(i, debouncedQuery)).length,
    }),
    [items, filtered.length, debouncedQuery],
  );

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2.5 text-foreground">
          <Search className="h-5 w-5 text-steel-600 dark:text-steel-400" strokeWidth={2} aria-hidden />
          <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Search
          </h1>
        </div>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Find conversations, live sessions, and surveys across the platform.
        </p>
      </header>

      <div
        role="search"
        aria-label="Search the platform"
        className="rounded-card border border-border/90 bg-card p-4 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_28px_-12px_rgba(0,0,0,0.45)] md:p-5"
      >
        <label htmlFor={`${id}-q`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Query
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
          <input
            id={`${id}-q`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title, topic, doctor, or description…"
            className={fieldClass}
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {debouncedQuery.length > 0 && debouncedQuery.length < 2
            ? 'Type at least 2 characters to search the catalog.'
            : debouncedQuery.length >= 2
              ? 'Searching conversations, live sessions, and surveys.'
              : 'Showing recent conversations until you search.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const count =
            key === 'best'
              ? undefined
              : key === 'webinars'
                ? counts.webinars
                : key === 'videos'
                  ? counts.videos
                  : counts.surveys;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                'inline-flex min-h-[40px] items-center gap-2 rounded-[6px] border px-3.5 py-2 text-xs font-semibold transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.97]',
                active
                  ? 'border-steel-600 bg-steel-600 text-white dark:border-steel-500 dark:bg-steel-500'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
              {typeof count === 'number' ? (
                <span className={active ? 'tabular-nums opacity-90' : 'tabular-nums text-muted-foreground'}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {showClipsError ? (
        <div className="rounded-card border border-warning/25 bg-warning/10 px-4 py-10 text-center">
          <p className="font-medium text-warning">Search temporarily unavailable</p>
          <p className="mt-1 text-sm text-warning/90">
            Try a shorter term or try again in a moment.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" aria-label="Searching" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-card border border-border bg-card p-12 text-center shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.45)]">
          <p className="font-medium text-foreground">No results</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {query
              ? 'Try a different search term or clear the filter.'
              : 'Content will appear here once the catalog is available.'}
          </p>
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="mt-4 inline-flex min-h-[40px] items-center rounded-[6px] border border-border bg-muted px-4 text-xs font-semibold text-foreground hover:bg-muted/80"
            >
              Clear search
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const webinarBadge =
              item.type === 'webinar'
                ? liveSessionListBadgeLabel(
                    item.registrationRequiresApproval,
                    statusByProgramId.get(item.programId),
                  )
                : null;
            const typeLabel =
              item.type === 'webinar'
                ? 'Live'
                : item.type === 'clip'
                  ? 'Video'
                  : 'Survey';
            const cta =
              item.type === 'survey'
                ? 'Open survey'
                : item.type === 'webinar'
                  ? 'View session'
                  : 'Watch';

            return (
              <li key={item.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-card border border-border/80 bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-10px_rgba(0,0,0,0.1)] transition-[box-shadow] duration-200 hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_10px_28px_-10px_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_6px_20px_-10px_rgba(0,0,0,0.45)]">
                  <div className="aspect-[16/10] shrink-0 bg-muted">
                    <img
                      src={item.imageUrl || FALLBACK_IMAGES[item.type === 'survey' ? 'survey' : item.type === 'webinar' ? 'webinar' : 'clip']}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-[6px] bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {typeLabel}
                      </span>
                      {webinarBadge ? (
                        <span className="rounded-[6px] border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-green-900 dark:text-green-200">
                          {webinarBadge}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {item.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                      {item.type === 'clip' && item.subtitle
                        ? item.subtitle
                        : item.description || item.title}
                    </p>
                    <Link
                      to={item.href}
                      className="mt-4 inline-flex h-9 w-fit items-center gap-1.5 rounded-[6px] bg-brand-600 px-3.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      {cta}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
