import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

// Healthcare stock images
const STOCK_IMAGES = {
  featuredSurvey: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
  activityCard: '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
  newestSurvey: '/images/iStock-1944379143-2231d19d-d87a-4843-9909-1b44a35f23ed.png',
  nextActivity: '/images/iStock-1861987830-c4d2cd71-5425-45e5-b008-167e41c1a284.png',
  survey: [
    '/images/iStock-1473559425-01131144-01b5-4e7d-9b15-f3db8846cad3.png',
    '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
    '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
    '/images/iStock-2036497889-fae3ed6e-9859-4983-b3ec-7a489bb6fb95.png',
    '/images/iStock-1344792109-f418c5f0-d729-4965-8b2a-bfff4368cea3.png',
  ],
} as const;

const SURVEYS = [
  { id: '1', title: 'Breast Cancer 101: Current Landscape Survey', imageUrl: STOCK_IMAGES.survey[0], description: 'Share your perspectives on current treatment approaches, emerging therapies, and clinical practice patterns in breast cancer care.' },
  { id: '2', title: 'Patient Care & Communication Survey', imageUrl: STOCK_IMAGES.survey[1], description: 'Help us understand how healthcare providers communicate with patients and what strategies improve shared decision-making.' },
  { id: '3', title: 'Caregiver Support & Wellness Survey', imageUrl: STOCK_IMAGES.survey[2], description: 'Tell us about the challenges and support needs of caregivers, and how we can better address their wellness and burnout.' },
  { id: '4', title: 'Clinical Research & Diagnostics Survey', imageUrl: STOCK_IMAGES.survey[3], description: 'Share your experience with diagnostic workflows, imaging protocols, and participation in clinical trials and research.' },
  { id: '5', title: 'Biomarkers & Precision Medicine Survey', imageUrl: STOCK_IMAGES.survey[4], description: 'Provide feedback on biomarker testing, targeted therapies, and how precision medicine is integrated into your practice.' },
  { id: '6', title: 'Treatment Adherence & Outcomes Survey', imageUrl: STOCK_IMAGES.survey[5], description: 'Help us learn about factors that influence treatment adherence and how outcomes are measured and reported in real-world settings.' },
];

export default function PublicSurveys() {
  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 md:py-14 space-y-10 md:space-y-14">
        {/* Header: Title + View All Diseases */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
            Surveys
          </h1>
          <Link
            to="/catalog"
            className="text-sm font-semibold text-gray-900 hover:text-gray-600 transition-colors w-fit"
          >
            View All Diseases
          </Link>
        </header>

        {/* Featured section: Featured Survey + Activity card */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Featured Survey (large) */}
          <Link
            to="/app/surveys"
            className="lg:col-span-8 group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 min-h-[280px] md:min-h-[320px]"
          >
            <img
              src={STOCK_IMAGES.featuredSurvey}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
            <span className="absolute left-4 top-4 rounded bg-[#000000] px-2.5 py-1 text-xs font-semibold text-white">
              New
            </span>
            <div className="absolute inset-0 p-6 flex flex-col justify-end">
              <p className="text-xl md:text-2xl font-semibold text-gray-900">
                HER2+ Treatment Sequencing Survey
              </p>
              <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
                Join Now <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </Link>

          {/* Survey Activity card (dark) */}
          <Link
            to="/app/surveys"
            className="lg:col-span-4 relative rounded-2xl overflow-hidden min-h-[200px] md:min-h-[320px] bg-gradient-to-br from-gray-900 to-emerald-950"
          >
            <img
              src={STOCK_IMAGES.activityCard}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              loading="eager"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex flex-col justify-between p-6">
              <p className="text-lg md:text-xl font-semibold text-white">
                85 Minutes of Survey Activity
              </p>
              <p className="text-sm text-gray-300">See More</p>
            </div>
          </Link>
        </section>

        {/* Horizontal featured cards: Newest Survey + Next Activity Type */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Link
            to="/app/surveys"
            className="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={STOCK_IMAGES.newestSurvey}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">Newest Survey</p>
            </div>
            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#000000] text-white group-hover:bg-gray-800 transition-colors">
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
          <Link
            to="/app/surveys"
            className="group flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
          >
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl">
              <img
                src={STOCK_IMAGES.nextActivity}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">Next Activity Type</p>
            </div>
            <span className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-[#000000] text-white group-hover:bg-gray-800 transition-colors">
              <ArrowRight className="h-5 w-5" />
            </span>
          </Link>
        </section>

        {/* Survey Catalogue */}
        <section className="space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
            Survey Catalogue
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SURVEYS.map((survey) => (
              <SurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SurveyCard({
  survey,
}: {
  survey: { id: string; title: string; imageUrl: string; description: string };
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col sm:flex-row">
      <div className="relative w-full sm:w-48 h-40 sm:h-auto shrink-0">
        <img src={survey.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
        <span className="absolute left-2 top-2 rounded bg-[#000000] px-2 py-0.5 text-xs font-semibold text-white">
          New
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className="font-bold text-gray-900">{survey.title}</h4>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed line-clamp-3 flex-1">
          {survey.description}
        </p>
        <div className="mt-4 flex justify-end">
          <Link
            to="/app/surveys"
            className="rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}
