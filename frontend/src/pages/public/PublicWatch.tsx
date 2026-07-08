import { Link, useParams } from 'react-router-dom';
import { Play, Bookmark, Calendar, User, Users, Eye } from 'lucide-react';

// Stock images (Figma node-id=237-3637)
const STOCK_IMAGE = 'https://picsum.photos/seed/watch-protocol/1200/600';
const STUDY_COLLECTIONS = [
  { key: 'treatment', title: 'Treatment Protocols', count: 5, items: [
    { title: 'Protocol Overview', duration: '45:32' },
    { title: 'Dosage Guidelines', duration: '3:45' },
    { title: 'Side Effects Management', duration: '4:12' },
  ]},
  { key: 'outcomes', title: 'Patient Outcomes', count: 8, items: [
    { title: 'Recovery Statistics', duration: '32:18' },
    { title: 'Quality of Life Metrics', duration: '2:59' },
    { title: 'Long-term Follow-up', duration: '3:22' },
  ]},
  { key: 'methodology', title: 'Research Methodology', count: 5, items: [
    { title: 'Study Design', duration: '35:15' },
    { title: 'Data Collection', duration: '3:18' },
    { title: 'Statistical Analysis', duration: '4:02' },
  ]},
  { key: 'clinical', title: 'Clinical Applications', count: 7, items: [
    { title: 'Implementation Guide', duration: '35:12' },
    { title: 'Best Practices', duration: '3:47' },
    { title: 'Case Studies', duration: '2:36' },
  ]},
  { key: 'interviews', title: 'Expert Interviews', count: 4, items: [
    { title: 'Dr. Sarah Chen Interview', duration: '42:15' },
    { title: 'Key Findings Summary', duration: '3:29' },
    { title: 'Future Research', duration: '4:03' },
  ]},
  { key: 'qa', title: 'Q&A Sessions', count: 9, items: [
    { title: 'Live Q&A Session', duration: '30:22' },
    { title: 'Common Questions', duration: '2:45' },
    { title: 'Technical Clarifications', duration: '3:31' },
  ]},
];

function getPageData(videoId: string | undefined) {
  return {
    breadcrumb: 'Breast Cancer Research',
    title: 'Advanced Treatment Protocols and Patient Outcomes',
    subtitle: 'Comprehensive analysis of innovative treatment approaches and their impact on patient recovery rates in breast cancer care.',
    studyDuration: '18 months',
    leadResearcher: 'Dr. Sarah Chen',
    participants: '240 patients',
    videoTitle: 'Breast Cancer Treatment Protocol Overview',
    videoDuration: '45:32',
    views: '1,247 views',
    description: 'Featuring Dr. VK Gadi and Dr. Ruta Rao discussing HER2-positive breast cancer, DESTINY-Breast 05 and 11, and HER2+ treatment approaches.',
    researchFocus: 'Novel immunotherapy combinations and targeted therapy protocols',
    institution: 'Memorial Cancer Research Center',
    publicationDate: 'March 2025',
    status: 'Completed',
  };
}

export default function PublicWatch() {
  const { videoId } = useParams<{ videoId?: string }>();
  const data = getPageData(videoId);

  return (
    <div className="bg-white min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Breadcrumb */}
        <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
          <User className="h-4 w-4" />
          {data.breadcrumb}
        </Link>

        {/* Page title + metadata */}
        <header className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            {data.title}
          </h1>
          <p className="text-base text-gray-600 leading-relaxed max-w-3xl">
            {data.subtitle}
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Study Duration: {data.studyDuration}
            </span>
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4" />
              Lead Researcher: {data.leadResearcher}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              Participants: {data.participants}
            </span>
          </div>
        </header>

        {/* Main content: Video + Video Information sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Study Presentation */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Main Study Presentation</h2>
            <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black aspect-video">
              <img src={STOCK_IMAGE} alt="" className="w-full h-full object-cover" loading="eager" referrerPolicy="no-referrer" />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20">
                <button className="h-20 w-20 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors">
                  <Play className="h-10 w-10 text-gray-900 ml-1" fill="currentColor" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-gray-900">{data.videoTitle}</p>
              <span className="text-sm text-gray-600">Duration: {data.videoDuration}</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="inline-flex items-center gap-2 rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                <Play className="h-4 w-4" /> Play
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50">
                <Bookmark className="h-4 w-4" /> Save
              </button>
              <span className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
                <Eye className="h-4 w-4" /> {data.views}
              </span>
            </div>
          </div>

          {/* Video Information sidebar */}
          <div className="lg:col-span-4">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 space-y-4 sticky top-24">
              <h3 className="font-bold text-gray-900">Video Information</h3>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{data.description}</p>
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-200">
                <p className="text-sm"><span className="font-semibold text-gray-900">Research Focus:</span> <span className="text-gray-600">{data.researchFocus}</span></p>
                <p className="text-sm"><span className="font-semibold text-gray-900">Institution:</span> <span className="text-gray-600">{data.institution}</span></p>
                <p className="text-sm"><span className="font-semibold text-gray-900">Publication Date:</span> <span className="text-gray-600">{data.publicationDate}</span></p>
                <p className="text-sm"><span className="font-semibold text-gray-900">Status:</span> <span className="text-gray-600">{data.status}</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Study Video Collections */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Study Video Collections
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {STUDY_COLLECTIONS.map((col) => (
              <div key={col.key} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                <div className="p-5">
                  <h4 className="font-bold text-gray-900">{col.title}</h4>
                  <p className="mt-0.5 text-sm text-gray-600 tabular-nums">{col.count} videos</p>
                  <ul className="mt-4 space-y-2">
                    {col.items.map((item, i) => (
                      <li key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-900">{item.title}</span>
                        <span className="text-gray-500 tabular-nums">{item.duration}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/catalog"
                    className="mt-4 inline-flex rounded-lg bg-[#000000] px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
                  >
                    View All Videos
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="pt-4">
          <Link to="/catalog" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700">
            ← Back to Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
