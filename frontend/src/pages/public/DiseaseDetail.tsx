import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Play, Clock } from 'lucide-react';

type PlaylistItem = {
  id: string;
  title: string;
  description?: string;
  durationMin?: number;
  speaker?: string;
  imageUrl: string;
};

type Subsection = {
  key: string;
  title: string;
  items: PlaylistItem[];
};

type DiseasePage = {
  slug: string;
  title: string;
  subtitle: string;
  heroImageUrl: string;
  sections: Subsection[];
};

const MOCK_DISEASES: DiseasePage[] = [
  {
    slug: 'breast-cancer',
    title: 'Breast Cancer',
    subtitle:
      'Explore expert-led video collections, treatment pathways, and key updates across breast cancer subtypes.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=2000&q=80',
    sections: [
      {
        key: 'general',
        title: 'General / Foundations',
        items: [
          {
            id: 'bc-101',
            title: 'Breast Cancer 101: Current Landscape',
            description: 'Overview of diagnostic + treatment pathways.',
            durationMin: 18,
            speaker: 'Dr. A. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=1400&q=80',
          },
          {
            id: 'bc-guidelines',
            title: 'Guidelines Update & Clinical Decision-Making',
            description: 'How guidelines translate into real-world care.',
            durationMin: 22,
            speaker: 'Dr. B. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1580281657527-47f249e8f7b7?auto=format&fit=crop&w=1400&q=80',
          },
        ],
      },
      {
        key: 'her2',
        title: 'HER2+',
        items: [
          {
            id: 'bc-her2-1',
            title: 'HER2+ Treatment Sequencing',
            description: 'Optimizing sequencing across stages.',
            durationMin: 16,
            speaker: 'Dr. C. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=1400&q=80',
          },
          {
            id: 'bc-her2-2',
            title: 'ADC Updates in HER2+ Disease',
            description: 'Key evidence & what it changes in practice.',
            durationMin: 14,
            speaker: 'Dr. D. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=1400&q=80',
          },
        ],
      },
      {
        key: 'tnbc',
        title: 'Triple Negative (TNBC)',
        items: [
          {
            id: 'bc-tnbc-1',
            title: 'TNBC: Biomarkers & Strategy',
            description: 'Using biomarkers to guide therapy selection.',
            durationMin: 20,
            speaker: 'Dr. E. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=1400&q=80',
          },
          {
            id: 'bc-tnbc-2',
            title: 'Neoadjuvant + Adjuvant Decision Points',
            description: 'Practical frameworks for real-world cases.',
            durationMin: 19,
            speaker: 'Dr. F. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1400&q=80',
          },
        ],
      },
      {
        key: 'hr',
        title: 'HR+ / HER2-',
        items: [
          {
            id: 'bc-hr-1',
            title: 'Endocrine Therapy + CDK4/6: What’s Next',
            description: 'Emerging updates and how to apply them.',
            durationMin: 17,
            speaker: 'Dr. G. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1400&q=80',
          },
          {
            id: 'bc-hr-2',
            title: 'Resistance & Sequencing in HR+ Disease',
            description: 'Common resistance patterns and next steps.',
            durationMin: 15,
            speaker: 'Dr. H. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
          },
        ],
      },
    ],
  },
  {
    slug: 'lung-cancer',
    title: 'Lung Cancer',
    subtitle:
      'Explore video collections covering biomarkers, treatment sequencing, and updates across lung cancer.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=2000&q=80',
    sections: [
      {
        key: 'general',
        title: 'General',
        items: [
          {
            id: 'lc-101',
            title: 'Lung Cancer 101: Biomarkers & Workup',
            description: 'How to structure workup + testing.',
            durationMin: 18,
            speaker: 'Dr. A. Speaker',
            imageUrl:
              'https://images.unsplash.com/photo-1580281657527-47f249e8f7b7?auto=format&fit=crop&w=1400&q=80',
          },
        ],
      },
    ],
  },
];

export default function DiseaseDetail() {
  const { diseaseSlug } = useParams<{ diseaseSlug: string }>();
  const navigate = useNavigate();

  const page = useMemo(() => {
    return (
      MOCK_DISEASES.find((d) => d.slug === diseaseSlug) ??
      ({
        slug: diseaseSlug || 'unknown',
        title: 'Treatment Content',
        subtitle: 'Explore curated content collections.',
        heroImageUrl:
          'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=2000&q=80',
        sections: [],
      } as DiseasePage)
    );
  }, [diseaseSlug]);

  const allItems = useMemo(() => {
    const items: PlaylistItem[] = [];
    for (const sec of page.sections) items.push(...(sec.items || []));
    return items;
  }, [page.sections]);

  function handlePlayAll() {
    const first = allItems[0];
    if (!first) return;
    navigate(`/watch/${first.id}`);
  }

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative">
        <div
          className="h-[340px] w-full bg-cover bg-center"
          style={{ backgroundImage: `url('${page.heroImageUrl}')` }}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative h-full mx-auto max-w-7xl px-6 flex flex-col justify-end pb-8 gap-4">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white w-fit"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Catalogue
            </button>

            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
              <div className="max-w-3xl space-y-3">
                <h1 className="text-4xl md:text-5xl font-semibold text-white">
                  {page.title}
                </h1>
                <p className="text-sm md:text-base text-white/90">
                  {page.subtitle}
                </p>
              </div>

              <button
                onClick={handlePlayAll}
                disabled={allItems.length === 0}
                className={[
                  'inline-flex items-center justify-center gap-2 rounded-full px-6 py-2 text-sm font-semibold',
                  allItems.length === 0
                    ? 'bg-white/30 text-white/70 cursor-not-allowed'
                    : 'bg-white text-gray-900 hover:bg-gray-100',
                ].join(' ')}
              >
                <Play className="h-4 w-4" />
                Play All
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-6 py-12 space-y-12">
        {/* Top quick links row (optional — keeps the design feeling “real”) */}
        <div className="flex flex-wrap items-center gap-3">
          <PillLink to="/catalog" label="All Treatments" />
          <PillLink to="/search" label="Search" />
          <PillLink to="/for-hcps" label="For HCPs" />
        </div>

        {/* Sections */}
        {page.sections.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-base font-semibold text-gray-900">
              No content yet
            </p>
            <p className="mt-1 text-sm text-gray-600">
              This treatment page will be populated with collections soon.
            </p>
            <div className="mt-6">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Back to Catalogue
              </Link>
            </div>
          </div>
        ) : (
          page.sections.map((sec) => (
            <section key={sec.key} className="space-y-5">
              <div className="flex items-end justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
                    {sec.title}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Curated video collections for this subtype.
                  </p>
                </div>

                <button className="text-sm font-semibold text-gray-900 hover:text-gray-700">
                  View All
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sec.items.map((item) => (
                  <PlaylistCard key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Explore another treatment */}
        <section className="rounded-2xl border border-gray-200 bg-gray-50 p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900">
              Explore another treatment
            </p>
            <p className="text-sm text-gray-600">
              Browse the catalogue for more disease areas and educational collections.
            </p>
          </div>

          <Link
            to="/catalog"
            className="rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black w-fit"
          >
            View Catalogue
          </Link>
        </section>
      </div>
    </div>
  );
}

function PlaylistCard({ item }: { item: PlaylistItem }) {
  return (
    <Link
      to={`/watch/${item.id}`}
      className="group rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-sm transition-shadow"
    >
      <div className="relative h-[190px]">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />

        <div className="relative h-full p-4 flex items-end justify-between">
          <div className="space-y-1">
            <p className="text-white font-semibold leading-snug line-clamp-2">
              {item.title}
            </p>
            <p className="text-white/90 text-xs line-clamp-2">
              {item.description || 'Educational collection'}
            </p>
          </div>

          <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
            <Play className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900 line-clamp-1">
            {item.speaker || 'Featured Speaker'}
          </p>

          {typeof item.durationMin === 'number' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600">
              <Clock className="h-4 w-4" />
              {item.durationMin} min
            </span>
          ) : null}
        </div>

        <p className="text-sm text-gray-600 line-clamp-2">
          {item.description || 'Explore key takeaways and clinical updates.'}
        </p>

        <div className="pt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900">Watch</span>
          <span className="text-gray-400 group-hover:text-gray-700 transition-colors">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}

function PillLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}
