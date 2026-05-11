import { Link, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Play, ArrowRight } from 'lucide-react';
import { catalogApi } from '../../api/catalog';
import { shouldSurfaceCatalogClip } from '../../utils/clipUrl';
import { webinarsApi } from '../../api/webinars';
import DISEASE_AREAS from '../../data/disease-areas';

export default function DiseaseDetail() {
  const { diseaseSlug } = useParams<{ diseaseSlug?: string }>();
  const location = useLocation();
  const isApp = location.pathname.startsWith('/app');
  const basePath = isApp ? '/app' : '';

  const area = DISEASE_AREAS.find((a) => a.slug === diseaseSlug);
  const title = area?.title ?? (diseaseSlug ? diseaseSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Disease Area');
  const tagRegex = area ? new RegExp(area.searchTags.join('|'), 'i') : null;

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clips, isLoading: clipsLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'disease', diseaseSlug],
    queryFn: () => catalogApi.getClips({ limit: 50, sort_by: 'recent' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: webinars = [] } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const matchedPlaylists = tagRegex ? playlists.filter((p) => tagRegex.test(p.title)) : playlists;
  const matchedClips = (tagRegex
    ? (clips?.items ?? []).filter((c) => tagRegex.test(c.title) || c.tags?.some((t) => tagRegex.test(t)))
    : (clips?.items ?? [])
  ).filter(shouldSurfaceCatalogClip);
  const matchedWebinars = tagRegex
    ? webinars.filter((w) => tagRegex.test(w.title) || tagRegex.test(w.description))
    : webinars;

  const isLoading = playlistsLoading || clipsLoading;

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

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && (
          <div className="space-y-10">
            {/* Live sessions */}
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

            {/* Playlists */}
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

            {/* Clips */}
            {matchedClips.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-gray-900">Conversations</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {matchedClips.slice(0, 12).map((c) => (
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
              </section>
            )}

            {matchedWebinars.length === 0 && matchedPlaylists.length === 0 && matchedClips.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-12 text-center">
                <p className="font-semibold text-gray-900">No content available yet for {title}</p>
                <p className="mt-1 text-sm text-gray-600">Check back soon or browse the full content library.</p>
                <Link
                  to={`${basePath}/catalog`}
                  className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-black active:scale-[0.96]"
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
