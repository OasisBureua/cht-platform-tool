import { Link } from 'react-router-dom';
import { ArrowRight, Dna } from 'lucide-react';

const AREAS = [
  {
    slug: 'breast-cancer',
    title: 'Breast Cancer',
    subtitle: 'Active',
    description: 'Expert-led education, conversations, and LIVE sessions focused on breast oncology.',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    active: true,
  },
  {
    slug: 'lung-cancer',
    title: 'Lung Cancer',
    subtitle: 'Coming Soon',
    description: 'Thoracic oncology content launching soon — clinical insights and treatment paradigms.',
    image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    active: false,
  },
  {
    slug: 'weight-loss',
    title: 'Weight Loss',
    subtitle: 'Coming Soon',
    description: 'Metabolic health and GLP-1 therapy conversations for clinicians and patients.',
    image: '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
    active: false,
  },
];

export default function DiseaseAreas() {
  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Dna className="h-7 w-7 text-gray-900" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Disease Areas</h1>
        </div>
        <p className="text-sm text-gray-600 max-w-2xl">
          Explore content by therapeutic area. Each disease area has its own templatized experience — LIVE sessions,
          conversations, surveys, and expert insights.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {AREAS.map((area) => (
          <div
            key={area.slug}
            className={[
              'rounded-2xl border overflow-hidden flex flex-col',
              area.active
                ? 'border-gray-200 bg-white hover:shadow-md transition-shadow'
                : 'border-dashed border-gray-300 bg-gray-50',
            ].join(' ')}
          >
            <div className="aspect-video bg-gray-100 relative">
              <img
                src={area.image}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              {!area.active && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-bold tracking-wide uppercase">{area.subtitle}</span>
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col flex-1 gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-lg">{area.title}</h3>
                {area.active && (
                  <span className="rounded-full bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 flex-1">{area.description}</p>
              {area.active ? (
                <Link
                  to={`/app/catalog/${area.slug}`}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:underline"
                >
                  Explore {area.title} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <p className="mt-2 text-xs text-gray-500 italic">
                  Content for this area is under development. Check back soon.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
