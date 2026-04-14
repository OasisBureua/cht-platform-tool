import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { surveysApi } from '../api/surveys';

// Same images as PublicSurveys
const STOCK_IMAGES = {
  featured: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
  activity: '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  avatar: '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
};

export default function Surveys() {
  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['surveys'],
    queryFn: surveysApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const survey = surveys[0];
  return (
    <div className="space-y-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Surveys</h1>

      {/* Featured Surveys - 2 cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link
          to={survey ? `/app/surveys/${survey.id}` : '/app/surveys'}
          className="group relative rounded-2xl overflow-hidden min-h-[260px]"
        >
          <img src={STOCK_IMAGES.featured} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white">{survey?.title ?? 'HER2+ Treatment Sequencing Survey'}</h3>
              <span className="mt-2 inline-block rounded-full bg-gray-800 px-3 py-1 text-xs font-semibold text-white">New</span>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
              Complete Now <span>→</span>
            </span>
          </div>
        </Link>
        <Link
          to="/app/surveys"
          className="group relative rounded-2xl overflow-hidden min-h-[260px]"
        >
          <img src={STOCK_IMAGES.activity} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <h3 className="text-xl font-bold text-white">85 Minutes of Survey Activity</h3>
            <p className="text-sm text-white/90">See More</p>
          </div>
        </Link>
      </section>

      {/* Survey Catalog */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Survey Catalog</h2>
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
          </div>
        ) : survey ? (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <img src={STOCK_IMAGES.avatar} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" loading="eager" referrerPolicy="no-referrer" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{survey.title}</p>
                <p className="text-sm text-gray-600">{survey.description || 'Complete this survey to share your feedback.'}</p>
              </div>
              <Link
                to={`/app/surveys/${survey.id}`}
                className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Complete
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <p className="font-semibold text-gray-900">No surveys available</p>
            <p className="mt-1 text-sm text-gray-600">Check back soon for new surveys.</p>
          </div>
        )}
      </section>
    </div>
  );
}
