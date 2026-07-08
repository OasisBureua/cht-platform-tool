import { useMemo, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Loader2, Play, ArrowRight } from 'lucide-react';
import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { webinarsApi } from '../../api/webinars';
import DISEASE_AREAS from '../../data/disease-areas';

const CLIPS_PAGE_SIZE = 24;

export default function DiseaseDetail() {
  const { diseaseSlug } = useParams<{ diseaseSlug?: string }>();
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const basePath = isApp ? '/app' : '';

  const area = DISEASE_AREAS.find((a) => a.slug === diseaseSlug);

  // 404 state: slug not recognized OR area has no `clipTags` contract yet
  // (e.g. lung-cancer / weight-loss are still inactive). Falling through
  // to unfiltered content was the bug the audit flagged.
  const isUnknownDisease = !area || !area.clipTags || area.clipTags.length === 0;

  const [clipsOffset, setClipsOffset] = useState(0);
  const [loadedClips, setLoadedClips] = useState<
    { offset: number; items: MediaHubClip[] }[]
  >([]);

  const tagParam = useMemo(
    () => (area?.clipTags && area.clipTags.length > 0 ? area.clipTags.join(',') : undefined),
    [area],
  );

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
    enabled: !isUnknownDisease,
  });

  const {
    data: clipsPage,
    isLoading: clipsLoading,
    isFetching: clipsFetching,
  } = useQuery({
    queryKey: ['catalog', 'clips', 'disease', diseaseSlug, tagParam, clipsOffset],
    queryFn: () =>
      catalogApi.getClips({
        tag: tagParam,
        sort_by: 'recorded_at',
        limit: CLIPS_PAGE_SIZE,
        offset: clipsOffset,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !isUnknownDisease && !!tagParam,
    placeholderData: keepPreviousData,
  });

  if (clipsPage && !loadedClips.some((p) => p.offset === clipsOffset)) {
    setLoadedClips((prev) =>
      prev.some((p) => p.offset === clipsOffset)
        ? prev
        : [...prev, { offset: clipsOffset, items: clipsPage.items }],
    );
  }

  const allClips = useMemo(
    () =>
      loadedClips
        .slice()
        .sort((a, b) => a.offset - b.offset)
        .flatMap((p) => p.items)
        .filter(shouldSurfaceCatalogClip),
    [loadedClips],
  );

  const totalClips = clipsPage?.total ?? 0;
  const hasMoreClips =
    !!clipsPage && clipsOffset + clipsPage.items.length < totalClips;

  const { data: webinars = [] } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
    enabled: !isUnknownDisease,
  });

  const matchedPlaylists = playlists;
  const matchedWebinars = webinars;

  const title =
    area?.title ??
    (diseaseSlug
      ? diseaseSlug
          .split('-')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : 'Disease Area');

  if (isUnknownDisease) {
    return (
      <div className={isApp ? 'space-y-8 pb-24 md:pb-0' : 'bg-white min-h-screen'}>
        <div className={isApp ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 space-y-8'}>
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {area
                  ? 'Content for this disease area is not available yet.'
                  : 'Disease area not found.'}
              </p>
            </div>
            <Link
              to={`${basePath}/catalog`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors w-fit"
            >
              All Content
            </Link>
          </header>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
            <p className="font-semibold text-gray-900">
              {area ? `${title} content is coming soon` : 'Disease area not found'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {area
                ? "We're curating expert-led content for this area. Browse the full library in the meantime."
                : "We couldn't find that disease area. Browse the full library or pick another area."}
            </p>
            <Link
              to={`${basePath}/catalog`}
              className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
            >
              Browse Library
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isInitialLoading = (playlistsLoading || clipsLoading) && allClips.length === 0;

  return (
    <div className={isApp ? 'space-y-8 pb-24 md:pb-0' : 'bg-white min-h-screen'}>
      <div className={isApp ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 space-y-8'}>
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
            {area && <p className="text-sm text-gray-600 mt-1">{area.description}</p>}
          </div>
          <Link
            to={`${basePath}/catalog`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors w-fit"
          >
            All Content
          </Link>
        </header>

        {isInitialLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        )}

        {!isInitialLoading && (
          <div className="space-y-10">
            {matchedWebinars.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Live Sessions</h2>
                  <Link to={`${basePath}/live`} className="text-sm font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
                    View all <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {matchedWebinars.slice(0, 6).map((w) => (
                    <Link
                      key={w.id}
                      to={isApp ? `/app/live/${w.id}` : `/live/${w.id}`}
                      className="rounded-2xl border border-gray-200 bg-white p-5 transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_12px_32px_-14px_rgba(0,0,0,0.1)] active:scale-[0.995]"
                    >
                      <p className="font-bold text-gray-900 line-clamp-2">{w.title}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{w.description}</p>
                      {w.startTime && (
                        <p className="mt-2 text-xs text-gray-500 tabular-nums">
                          {new Date(w.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {w.duration ? ` · ${w.duration} min` : ''}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {matchedPlaylists.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Playlists</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {matchedPlaylists.slice(0, 9).map((p) => (
                    <Link
                      key={p.id}
                      to={`${basePath}/catalog/playlist/${p.id}`}
                      className="rounded-2xl border border-gray-200 bg-white overflow-hidden transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.05),0_12px_32px_-14px_rgba(0,0,0,0.1)] active:scale-[0.995]"
                    >
                      <div className="aspect-video bg-gray-100">
                        <img src={p.thumbnailUrl} alt={p.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      </div>
                      <div className="p-4">
                        <p className="font-bold text-gray-900 line-clamp-2">{p.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{p.videoCount} videos</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {allClips.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Conversations</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {allClips.map((c) => (
                    <Link
                      key={c.id}
                      to={`${basePath}/catalog/clip/${c.id}`}
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-10px_rgba(0,0,0,0.08)] active:scale-[0.995] group"
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <Play className="h-8 w-8 text-white" fill="white" />
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="font-medium text-gray-900 text-xs line-clamp-2">{c.title}</p>
                      </div>
                    </Link>
                  ))}
                </div>

                {hasMoreClips && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      disabled={clipsFetching}
                      onClick={() => setClipsOffset(clipsOffset + CLIPS_PAGE_SIZE)}
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {clipsFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                      Load more
                    </button>
                  </div>
                )}
              </section>
            )}

            {matchedWebinars.length === 0 && matchedPlaylists.length === 0 && allClips.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
                <p className="font-semibold text-gray-900">No content available yet for {title}</p>
                <p className="mt-1 text-sm text-gray-600">Check back soon or browse the full content library.</p>
                <Link
                  to={`${basePath}/catalog`}
                  className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-brand-700 active:scale-[0.96]"
                >
                  Browse Library
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
