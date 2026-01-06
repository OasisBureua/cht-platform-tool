import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { programsApi, type Program, type Video } from '../api/programs';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

function flattenVideos(programs: Program[]) {
  const items: Array<{ program: Program; video: Video }> = [];
  for (const p of programs) {
    for (const v of p.videos || []) items.push({ program: p, video: v });
  }
  return items;
}

export default function Watch() {
  const navigate = useNavigate();
  const [visibleCount, setVisibleCount] = useState(10);

  const { data: programs, isLoading } = useQuery({
    queryKey: ['programs'],
    queryFn: programsApi.getAll,
  });

  const allVideos = useMemo(() => {
    return programs ? flattenVideos(programs) : [];
  }, [programs]);

  const featured = allVideos[0];
  const canShowMore = allVideos.length > visibleCount;

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Watch & Earn</h1>
        <p className="text-sm text-gray-600">Educational Library</p>
      </header>

      {/* Featured Video */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Featured Video</h2>

        {featured ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{featured.video.title}</p>
                <p className="text-sm text-gray-600">
                  {featured.video.description || featured.program.title}
                </p>
                <p className="text-sm text-gray-700">
                  {featured.program.sponsorName} •{' '}
                  {featured.video.duration ? `${Math.round(featured.video.duration / 60)} min` : 'Video'}
                </p>
              </div>

              <div className="md:pt-1 flex gap-2">
                <button
                  onClick={() => navigate(`/watch/${featured.video.id}`)}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Start Watching
                </button>
                <button
                  onClick={() => navigate(`/watch/${featured.video.id}`)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="font-semibold text-gray-900">No videos available</p>
            <p className="text-sm text-gray-600 mt-1">
              Add videos to programs to populate Watch & Earn.
            </p>
          </div>
        )}
      </section>

      {/* Video list */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Educational Videos</h2>
          <button className="text-sm font-medium text-gray-700 hover:text-gray-900">
            View All Videos
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {allVideos.slice(0, visibleCount).map(({ program, video }) => (
              <div key={video.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{video.title}</p>
                  <p className="text-sm text-gray-600 truncate">
                    {program.sponsorName} • {program.title}
                  </p>
                </div>

                <button
                  onClick={() => navigate(`/watch/${video.id}`)}
                  className="shrink-0 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  More Info →
                </button>
              </div>
            ))}
          </div>

          {canShowMore ? (
            <div className="p-3">
              <button
                onClick={() => setVisibleCount((v) => v + 10)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Show More
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
