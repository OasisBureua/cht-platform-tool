import { useMemo, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Loader2, Play, ArrowRight } from 'lucide-react';
import { catalogApi, type MediaHubClip } from '../../api/catalog';
import { shouldSurfaceCatalogClip, getShortClipId } from '../../utils/clipUrl';
import { webinarsApi } from '../../api/webinars';
import DISEASE_AREAS from '../../data/disease-areas';
import { WordPressCategoryNav } from '../../components/content/WordPressCategoryNav';
import {
  formatWordPressCategoryLabel,
  useWordPressCatalog,
  WORDPRESS_CATALOG_STALE_MS,
  WORDPRESS_LOW_COUNT_THRESHOLD,
} from '../../utils/wordpressCatalog';

const CLIPS_PAGE_SIZE = 24;

export default function DiseaseDetail() {
  const { diseaseSlug } = useParams<{ diseaseSlug?: string }>();
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const basePath = isApp ? '/app' : '';
  const wpMode = useWordPressCatalog();

  const { data: wpCategories } = useQuery({
    queryKey: ['catalog', 'wordpress', 'categories'],
    queryFn: catalogApi.getWordPressCategories,
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: wpMode,
  });

  const wpCategory = wpCategories?.items?.find((c) => c.slug === diseaseSlug);
  const legacyArea = DISEASE_AREAS.find((a) => a.slug === diseaseSlug);

  const isUnknownDisease = wpMode
    ? !diseaseSlug
    : !legacyArea || !legacyArea.clipTags || legacyArea.clipTags.length === 0;

  const [clipsOffset, setClipsOffset] = useState(0);
  const [loadedClips, setLoadedClips] = useState<
    { offset: number; items: MediaHubClip[] }[]
  >([]);

  const tagParam = useMemo(
    () =>
      !wpMode && legacyArea?.clipTags?.length
        ? legacyArea.clipTags.join(',')
        : undefined,
    [wpMode, legacyArea],
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
    queryKey: [
      'catalog',
      'clips',
      'disease',
      diseaseSlug,
      wpMode ? 'wp' : tagParam,
      clipsOffset,
    ],
    queryFn: () =>
      catalogApi.getClips({
        ...(wpMode
          ? { has_wordpress: true, wp_category: diseaseSlug }
          : { tag: tagParam }),
        sort_by: 'recorded_at',
        limit: CLIPS_PAGE_SIZE,
        offset: clipsOffset,
      }),
    staleTime: WORDPRESS_CATALOG_STALE_MS,
    enabled: !isUnknownDisease && (wpMode ? !!diseaseSlug : !!tagParam),
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
        .filter((c) => shouldSurfaceCatalogClip(c)),
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

  const title = wpMode
    ? formatWordPressCategoryLabel(diseaseSlug ?? '')
    : legacyArea?.title ??
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
          <WordPressCategoryNav basePath={basePath} />
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
              <p className="text-sm text-gray-600 mt-1">
                {wpMode
                  ? 'Category not found or has no published clips yet.'
                  : legacyArea
                    ? 'Content for this disease area is not available yet.'
                    : 'Disease area not found.'}
              </p>
            </div>
            <Link
              to={`${basePath}/catalog`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 w-fit"
            >
              All Content
            </Link>
          </header>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
            <Link
              to={`${basePath}/catalog`}
              className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
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
        <WordPressCategoryNav basePath={basePath} activeSlug={diseaseSlug} />

        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600 mt-1">
              {wpMode
                ? `${wpCategory?.post_count ?? allClips.length} editorial clips`
                : legacyArea?.description}
            </p>
          </div>
          <Link
            to={`${basePath}/catalog`}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 w-fit"
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
            {webinars.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Live Sessions</h2>
                  <Link to={`${basePath}/live`} className="text-sm font-semibold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
                    View all <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {webinars.slice(0, 6).map((w) => (
                    <Link
                      key={w.id}
                      to={isApp ? `/app/live/${w.id}` : `/live/${w.id}`}
                      className="rounded-2xl border border-gray-200 bg-white p-5 hover:shadow-md"
                    >
                      <p className="font-bold text-gray-900 line-clamp-2">{w.title}</p>
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
                      to={
                        isApp
                          ? `/app/clip/${getShortClipId(c.id)}`
                          : `/catalog/clip/${getShortClipId(c.id)}`
                      }
                      className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md group"
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        <img src={c.thumbnail_url} alt={c.title} className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                          <Play className="h-8 w-8 text-white" fill="white" />
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="font-medium text-gray-900 text-xs line-clamp-2">{c.title}</p>
                        {c.wordpress?.series?.[0] ? (
                          <p className="mt-1 text-[10px] text-gray-500 line-clamp-1">
                            {c.wordpress.series[0].replace(/-/g, ' ')}
                          </p>
                        ) : null}
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
                      className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      {clipsFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                      Load more
                    </button>
                  </div>
                )}
              </section>
            )}

            {webinars.length === 0 && allClips.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
                {wpMode && (wpCategory?.post_count ?? 0) < WORDPRESS_LOW_COUNT_THRESHOLD ? (
                  <>
                    <p className="font-semibold text-gray-900">Coverage for {title} is growing</p>
                    <p className="mt-2 text-sm text-gray-600">
                      New editorial segments are added weekly. Check back soon or browse the full library.
                    </p>
                  </>
                ) : (
                  <p className="font-semibold text-gray-900">No content available yet for {title}</p>
                )}
                <Link to={`${basePath}/catalog`} className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
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
