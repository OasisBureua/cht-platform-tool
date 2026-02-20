import { Link, useParams } from 'react-router-dom';

// Stock images for all catalog cards (consistent across disease pages)
const STOCK_IMAGES = {
  featuredVideo: 'https://picsum.photos/seed/catalog-video/800/500',
  featuredWebinar: 'https://picsum.photos/seed/catalog-webinar/800/500',
  featuredSurvey: 'https://picsum.photos/seed/catalog-survey/800/400',
  featuredStudy: 'https://picsum.photos/seed/catalog-study/800/400',
  biomarker: [
    'https://picsum.photos/seed/catalog-bio1/600/360',
    'https://picsum.photos/seed/catalog-bio2/600/360',
    'https://picsum.photos/seed/catalog-bio3/600/360',
  ],
} as const;

type BiomarkerCard = {
  id: string;
  title: string;
  contentTypes: string[];
  imageUrl: string;
};

type BiomarkerSection = {
  key: string;
  title: string;
  cards: BiomarkerCard[];
};

type DiseasePageData = {
  slug: string;
  title: string;
  featuredVideo: { title: string; imageUrl: string };
  featuredWebinar: { title: string; imageUrl: string };
  featuredSurvey: { title: string; imageUrl: string };
  featuredStudy: { title: string; imageUrl: string };
  biomarkerSections: BiomarkerSection[];
};

function getPageData(slug: string | undefined): DiseasePageData {
  const title = slug ? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'Content Library';
  const biomarkerCards: BiomarkerCard[] = [
    { id: '1', title: 'Biologic Process Change', contentTypes: ['Video', 'Audio', 'White Paper'], imageUrl: STOCK_IMAGES.biomarker[0] },
    { id: '2', title: 'ADC-Conjugate Considerations', contentTypes: ['Case Study', 'Journal Article'], imageUrl: STOCK_IMAGES.biomarker[1] },
    { id: '3', title: 'Expert Conversations & Group Dives', contentTypes: ['Podcast', 'Interview'], imageUrl: STOCK_IMAGES.biomarker[2] },
  ];

  const sections: BiomarkerSection[] = [
    { key: 'her2', title: 'HER2+', cards: biomarkerCards },
    { key: 'hr', title: 'HR+', cards: biomarkerCards },
    { key: 'tnbc', title: 'Triple Negative', cards: biomarkerCards },
    { key: 'her2low', title: 'HER2 Low/Ultralow', cards: biomarkerCards },
    { key: 'highrisk', title: 'High Risk', cards: biomarkerCards },
  ];

  return {
    slug: slug || 'catalog',
    title,
    featuredVideo: { title: 'Featured Video Title', imageUrl: STOCK_IMAGES.featuredVideo },
    featuredWebinar: { title: 'Featured Webinar Title', imageUrl: STOCK_IMAGES.featuredWebinar },
    featuredSurvey: { title: 'Featured Survey', imageUrl: STOCK_IMAGES.featuredSurvey },
    featuredStudy: { title: 'Featured Study', imageUrl: STOCK_IMAGES.featuredStudy },
    biomarkerSections: sections,
  };
}

export default function DiseaseDetail() {
  const { diseaseSlug } = useParams<{ diseaseSlug?: string }>();
  const page = getPageData(diseaseSlug);

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        {/* Hero: Title + View All Biomarkers */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">{page.title}</h1>
          <Link
            to="/catalog"
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors w-fit"
          >
            View All Biomarkers
          </Link>
        </header>

        {/* Featured content: 2 large + 2 small cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FeaturedCard
            title={page.featuredVideo.title}
            imageUrl={page.featuredVideo.imageUrl}
            cta="Watch Now"
            size="large"
            to="/watch"
          />
          <FeaturedCard
            title={page.featuredWebinar.title}
            imageUrl={page.featuredWebinar.imageUrl}
            cta="Join Now"
            size="large"
            to="/catalog"
          />
          <FeaturedCard
            title={page.featuredSurvey.title}
            imageUrl={page.featuredSurvey.imageUrl}
            cta="View Now"
            size="small"
            to="/catalog"
          />
          <FeaturedCard
            title={page.featuredStudy.title}
            imageUrl={page.featuredStudy.imageUrl}
            cta="View Now"
            size="small"
            to="/catalog"
          />
        </section>

        {/* Biomarker Playlists */}
        <section className="space-y-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Biomarker Playlists</h2>

          {page.biomarkerSections.map((sec) => (
            <div key={sec.key} className="space-y-5">
              <h3 className="text-xl font-bold text-gray-900">{sec.title}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sec.cards.map((card) => (
                  <BiomarkerCard key={card.id} card={card} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function FeaturedCard({
  title,
  imageUrl,
  cta,
  size,
  to,
}: {
  title: string;
  imageUrl: string;
  cta: string;
  size: 'large' | 'small';
  to: string;
}) {
  const isLarge = size === 'large';
  return (
    <Link
      to={to}
      className={`group relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 ${
        isLarge ? 'min-h-[220px] md:min-h-[260px]' : 'min-h-[160px]'
      }`}
    >
      <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
      <div className="absolute inset-0 p-5 flex flex-col justify-end">
        <p className="text-lg font-semibold text-gray-900">{title}</p>
        <span className="mt-2 inline-flex w-fit rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors">
          {cta}
        </span>
      </div>
    </Link>
  );
}

function BiomarkerCard({ card }: { card: BiomarkerCard }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="relative h-[180px]">
        <img src={card.imageUrl} alt="" className="h-full w-full object-cover" loading="eager" referrerPolicy="no-referrer" />
      </div>
      <div className="p-5 space-y-4">
        <h4 className="font-bold text-gray-900">{card.title}</h4>
        <ul className="space-y-1">
          {card.contentTypes.map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm text-gray-600">
              <span className="h-1 w-1 rounded-full bg-gray-400" />
              {t}
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Link
            to="/watch"
            className="rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            View All
          </Link>
        </div>
      </div>
    </div>
  );
}
