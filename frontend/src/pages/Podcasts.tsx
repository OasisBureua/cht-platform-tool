import { Mic2, ExternalLink } from 'lucide-react';

const SHOWS = [
  {
    id: 'breast-friends',
    title: 'Breast Friends',
    tagline: 'Real conversations about breast cancer, unfiltered, expert-led, and community-driven.',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    active: true,
    episodes: [
      { title: 'Ep 1: Navigating Your First Diagnosis', duration: '38 min' },
      { title: 'Ep 2: Treatment Options Demystified', duration: '42 min' },
      { title: 'Ep 3: Living Beyond Treatment', duration: '35 min' },
    ],
  },
  {
    id: 'coming-soon-1',
    title: 'Coming Soon',
    tagline: 'New podcast properties launching across disease areas and specialties.',
    image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    active: false,
    episodes: [],
  },
];

export default function Podcasts() {
  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Mic2 className="h-7 w-7 text-gray-900" />
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Podcasts</h1>
        </div>
        <p className="text-sm text-gray-600 max-w-2xl">
          Listen to expert-driven podcast series. More editorial, more artistic, more brand-forward.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SHOWS.map((show) => (
          <div
            key={show.id}
            className={[
              'rounded-2xl border overflow-hidden flex flex-col',
              show.active ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50 opacity-70',
            ].join(' ')}
          >
            <div className="aspect-[16/9] bg-gray-100 relative">
              <img src={show.image} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
              {!show.active && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-lg font-bold tracking-wide">Coming Soon</span>
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col flex-1 gap-3">
              <h2 className="text-xl font-bold text-gray-900">{show.title}</h2>
              <p className="text-sm text-gray-600">{show.tagline}</p>
              {show.active && show.episodes.length > 0 && (
                <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl mt-1">
                  {show.episodes.map((ep) => (
                    <li key={ep.title} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium text-gray-900">{ep.title}</span>
                      <span className="text-gray-500 shrink-0 ml-3">{ep.duration}</span>
                    </li>
                  ))}
                </ul>
              )}
              {show.active && (
                <a
                  href="#"
                  className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:underline"
                >
                  Listen now <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
