import { Link } from 'react-router-dom';
import { Stethoscope, ArrowRight } from 'lucide-react';

const FEATURED_DOCS = [
  {
    name: 'Dr. Sara Tolaney',
    specialty: 'Medical Oncology — Breast Cancer',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    slug: 'sara-tolaney',
    bio: 'Leading expert in HER2+ and triple-negative breast cancer with extensive clinical trial experience.',
  },
  {
    name: 'Dr. Fatima Cardoso',
    specialty: 'Medical Oncology — Breast Cancer',
    image: '/images/iStock-1667819272-cc7e9fde-feb0-4590-bb35-f5a86deba0dd.png',
    slug: 'fatima-cardoso',
    bio: 'Internationally recognized for guidelines in metastatic breast cancer and patient advocacy.',
  },
  {
    name: 'Dr. Heather Wakelee',
    specialty: 'Thoracic Oncology — Lung Cancer',
    image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    slug: 'heather-wakelee',
    bio: 'Expert in early-stage and locally advanced NSCLC clinical trials and novel therapeutics.',
  },
];

export default function ChmDocs() {
  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Stethoscope className="h-7 w-7 text-gray-900" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">CHM DOC&apos;s</h1>
        </div>
        <p className="text-sm text-gray-600 max-w-2xl">
          Doctor-led conversations and expert insights. Ongoing engagement beyond live events — hear directly from the
          physicians shaping clinical practice.
        </p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURED_DOCS.map((doc) => (
          <div
            key={doc.slug}
            className="rounded-2xl border border-gray-200 bg-white overflow-hidden hover:shadow-md transition-shadow flex flex-col"
          >
            <div className="aspect-video bg-gray-100">
              <img src={doc.image} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
            </div>
            <div className="p-5 flex flex-col flex-1 gap-2">
              <h3 className="font-bold text-gray-900 text-lg">{doc.name}</h3>
              <p className="text-xs font-medium text-gray-500">{doc.specialty}</p>
              <p className="text-sm text-gray-600 flex-1">{doc.bio}</p>
              <Link
                to={`/app/catalog`}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 hover:underline"
              >
                View conversations <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">More experts coming soon</h2>
        <p className="text-sm text-gray-600">
          CHM DOC&apos;s is a growing pillar of expert-led content. Stay tuned for new physicians, specialties, and
          conversation series.
        </p>
      </section>
    </div>
  );
}
