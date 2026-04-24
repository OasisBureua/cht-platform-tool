import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Dna, Loader2, Play } from 'lucide-react';
import { catalogApi } from '../api/catalog';
import { webinarsApi } from '../api/webinars';
import DISEASE_AREAS from '../data/disease-areas';

export default function DiseaseAreas() {
  const { data: playlists = [], isLoading: playlistsLoading } = useQuery({
    queryKey: ['catalog', 'playlists'],
    queryFn: catalogApi.getPlaylists,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clips, isLoading: clipsLoading } = useQuery({
    queryKey: ['catalog', 'clips', 'disease-areas'],
    queryFn: () => catalogApi.getClips({ limit: 50, sort_by: 'recent' }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: webinars = [] } = useQuery({
    queryKey: ['webinars'],
    queryFn: webinarsApi.list,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = playlistsLoading || clipsLoading;

  return (
    <div className="space-y-10 pb-24 md:pb-0">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Dna className="h-7 w-7 text-gray-900" />
          <h1 className="text-balance text-2xl font-bold text-gray-900 md:text-3xl">Disease Areas</h1>
        </div>
        <p className="text-pretty max-w-2xl text-sm text-gray-600">
          Explore content by therapeutic area. Each disease area has LIVE sessions, conversations,
          surveys, and expert insights — all in one place.
        </p>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      )}

      {!isLoading &&
        DISEASE_AREAS.map((area) => {
          const tagRegex = new RegExp(area.searchTags.join('|'), 'i');
          const matchedPlaylists = playlists.filter((p) => tagRegex.test(p.title));
          const matchedClips = (clips?.items ?? []).filter(
            (c) => tagRegex.test(c.title) || c.tags?.some((t) => tagRegex.test(t)),
          );
          const matchedWebinars = webinars.filter((w) => tagRegex.test(w.title) || tagRegex.test(w.description));

          return (
            <section key={area.slug} className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={area.image}
                    alt=""
                    className="h-12 w-12 rounded-xl object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">{area.title}</h2>
                      {area.active ? (
                        <span className="rounded-full bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-200 text-gray-600 text-[10px] font-bold px-2 py-0.5 uppercase">
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{area.description}</p>
                  </div>
                </div>
                {area.active && (
                  <Link
                    to={`/app/catalog/${area.slug}`}
                    className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-gray-900 hover:underline"
                  >
                    View all <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>

              {!area.active ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-500">
                    Content for {area.title} is under development. Check back soon.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* LIVE sessions for this area */}
                  {matchedWebinars.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        LIVE Sessions · {matchedWebinars.length}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matchedWebinars.slice(0, 3).map((w) => (
                          <Link
                            key={w.id}
                            to={`/app/live/${w.id}`}
                            className="rounded-xl border border-gray-200 bg-white p-4 transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-8px_rgba(0,0,0,0.08)] active:scale-[0.995]"
                          >
                            <p className="font-semibold text-gray-900 line-clamp-2">{w.title}</p>
                            {w.startTime && (
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(w.startTime).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playlists for this area */}
                  {matchedPlaylists.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        Playlists · {matchedPlaylists.length}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {matchedPlaylists.slice(0, 6).map((p) => (
                          <Link
                            key={p.id}
                            to={`/app/catalog/playlist/${p.id}`}
                            className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-8px_rgba(0,0,0,0.08)] active:scale-[0.995]"
                          >
                            <div className="aspect-video bg-gray-100">
                              <img
                                src={p.thumbnailUrl}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="p-3">
                              <p className="font-semibold text-gray-900 text-sm line-clamp-2">{p.title}</p>
                              <p className="text-xs text-gray-500 mt-1">{p.videoCount} videos</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent clips for this area */}
                  {matchedClips.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        Recent Conversations · {matchedClips.length}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {matchedClips.slice(0, 8).map((c) => (
                          <Link
                            key={c.id}
                            to={`/app/catalog/clip/${c.id}`}
                            className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_1px_0_rgba(0,0,0,0.04),0_6px_20px_-8px_rgba(0,0,0,0.08)] active:scale-[0.995] group"
                          >
                            <div className="aspect-video bg-gray-100 relative">
                              <img
                                src={c.thumbnail_url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
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
                    </div>
                  )}

                  {matchedPlaylists.length === 0 && matchedClips.length === 0 && matchedWebinars.length === 0 && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
                      <p className="text-sm text-gray-500">
                        No content matched yet. Browse the{' '}
                        <Link to={`/app/catalog/${area.slug}`} className="font-semibold text-gray-900 hover:underline">
                          full catalog
                        </Link>{' '}
                        for {area.title}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
    </div>
  );
}
