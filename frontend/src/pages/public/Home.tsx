import { Link } from 'react-router-dom';
import {
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Volume2,
  ArrowRight,
} from 'lucide-react';

type FeaturedVideo = {
  id: string;
  title: string;
  imageUrl: string;
};

type Treatment = {
  id: string;
  title: string;
  imageUrl: string;
};

type Resource = {
  id: string;
  title: string;
  href: string;
  imageUrl: string;
  icon: React.ReactNode;
  colSpan?: string; // tailwind col-span helper for nicer grid
};

export default function Home() {
  // ---- Mock content (replace later with API) ----
  const featuredVideos: FeaturedVideo[] = [
    {
      id: 'f1',
      title: 'Featured Video 1',
      imageUrl:
        'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=1600&q=80',
    },
    {
      id: 'f2',
      title: 'Featured Video 2',
      imageUrl:
        'https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&w=1600&q=80',
    },
    {
      id: 'f3',
      title: 'Featured Video 3',
      imageUrl:
        'https://images.unsplash.com/photo-1580281658628-9b083b59f7f5?auto=format&fit=crop&w=1600&q=80',
    },
  ];

  const treatments: Treatment[] = [
    {
      id: 't1',
      title: 'Breast Cancer',
      imageUrl:
        'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80',
    },
    {
      id: 't2',
      title: 'Weight Loss',
      imageUrl:
        'https://images.unsplash.com/photo-1559757175-5700dde67548?auto=format&fit=crop&w=1600&q=80',
    },
    {
      id: 't3',
      title: 'Cardiology',
      imageUrl:
        'https://images.unsplash.com/photo-1580281657527-47f249e8f7b7?auto=format&fit=crop&w=1600&q=80',
    },
  ];

  const resources: Resource[] = [
    {
      id: 'r1',
      title: 'Webinars',
      href: '/catalog',
      imageUrl:
        'https://images.unsplash.com/photo-1515165562835-c4c45d7a3c6b?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">M</span>,
    },
    {
      id: 'r2',
      title: 'Podcasts',
      href: '/catalog',
      imageUrl:
        'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">🎙️</span>,
    },
    {
      id: 'r3',
      title: 'Blog',
      href: '/catalog',
      imageUrl:
        'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">📰</span>,
    },
    {
      id: 'r4',
      title: 'Watch',
      href: '/watch/demo',
      imageUrl:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">▶</span>,
    },
    {
      id: 'r5',
      title: 'Surveys',
      href: '/catalog',
      imageUrl:
        'https://images.unsplash.com/photo-1580281658493-74ad1b3b08b5?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">🕒</span>,
      colSpan: 'md:col-span-1',
    },
    {
      id: 'r6',
      title: 'Events',
      href: '/catalog',
      imageUrl:
        'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
      icon: <span className="text-3xl font-black">👥</span>,
      colSpan: 'md:col-span-1',
    },
    {
      id: 'r7',
      title: 'Search Treatments',
      href: '/search',
      imageUrl:
        'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&w=1600&q=80',
      icon: <Search className="h-10 w-10" />,
      colSpan: 'md:col-span-2',
    },
  ];

  return (
    <div className="bg-white">
      {/* =========================
          HERO
          ========================= */}
      <section className="relative">
        <div
          className="h-[520px] w-full bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=2000&q=80')",
          }}
        >
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative h-full mx-auto max-w-7xl px-6 flex items-center justify-center text-center">
            <div className="max-w-3xl space-y-6">
              <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                Innovating the next phase of
                <br />
                Healthcare through Information
              </h1>

              <p className="text-sm md:text-base text-white/90 leading-relaxed">
                Community Health Media (CHM) is your full service healthcare
                communications partner, combining our production expertise with
                targeted multi-channel campaigns.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/catalog"
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100"
                >
                  View content
                </Link>
                <Link
                  to="/join"
                  className="rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black inline-flex items-center gap-2"
                >
                  Join Now <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          FEATURED VIDEOS
          ========================= */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-10">
          <h2 className="text-3xl md:text-4xl font-semibold text-center text-gray-900">
            Featured Videos
          </h2>

          <div className="relative">
            {/* Strip with side peeks */}
            <div className="flex items-center justify-center gap-6">
              {/* left peek */}
              <div className="hidden md:block w-[240px] h-[180px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={featuredVideos[0].imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              </div>

              {/* center */}
              <div className="w-full max-w-[760px] h-[240px] md:h-[320px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={featuredVideos[1].imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>

              {/* right peek */}
              <div className="hidden md:block w-[240px] h-[180px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={featuredVideos[2].imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="mt-5 flex items-center justify-center">
              <div className="rounded-full bg-gray-200/70 px-3 py-2 flex items-center gap-2">
                <button className="h-9 w-9 rounded-full bg-white flex items-center justify-center">
                  <Play className="h-4 w-4 text-gray-900" />
                </button>
                <button className="h-9 w-9 rounded-full bg-white flex items-center justify-center">
                  <ChevronLeft className="h-4 w-4 text-gray-900" />
                </button>
                <button className="h-9 w-9 rounded-full bg-white flex items-center justify-center">
                  <ChevronRight className="h-4 w-4 text-gray-900" />
                </button>
                <button className="h-9 w-9 rounded-full bg-white flex items-center justify-center">
                  <Volume2 className="h-4 w-4 text-gray-900" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          TREATMENT SPECIFIC CONTENT
          ========================= */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-3xl md:text-4xl font-semibold text-gray-900">
              View treatment specific content
            </h3>
            <p className="text-sm text-gray-600">
              Lorem ipsum dolor sit amet consectetur suspendisse ultrices
            </p>
          </div>

          {/* Carousel (static layout, demo) */}
          <div className="relative">
            <div className="flex items-center justify-center gap-6">
              {/* left peek */}
              <div className="hidden md:block w-[260px] h-[170px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={treatments[2].imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
                <div className="absolute" />
              </div>

              {/* center */}
              <div className="relative w-full max-w-[860px] h-[220px] md:h-[260px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={treatments[0].imageUrl}
                  alt={treatments[0].title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 p-6 flex items-center justify-between">
                  <p className="text-2xl md:text-3xl font-semibold text-white">
                    {treatments[0].title}
                  </p>

                  <Link
                    to="/catalog/breast-cancer"
                    className="text-sm font-semibold text-white underline underline-offset-4"
                  >
                    Explore Treatment
                  </Link>
                </div>
              </div>

              {/* right peek */}
              <div className="hidden md:block w-[260px] h-[170px] rounded-2xl overflow-hidden bg-gray-200">
                <img
                  src={treatments[1].imageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              </div>
            </div>

            {/* Dots */}
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-gray-900" />
              <span className="h-2 w-2 rounded-full bg-gray-300" />
              <span className="h-2 w-2 rounded-full bg-gray-300" />
            </div>
          </div>
        </div>
      </section>

      {/* =========================
          WEBINAR SPOTLIGHT
          ========================= */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left */}
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-600">Webinars</p>
            <h4 className="text-3xl font-semibold text-gray-900">
              Content Title
            </h4>
            <p className="text-sm text-gray-700">2:00 PM EST</p>

            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-gray-900">
                Webinar Description:
              </p>
              <p>
                Co-hosted by Dr. Jason Mouabbi, breast medical oncologist at MD
                Anderson Cancer Center, and Dr. Paolo Tarantino,
                clinician-scientist at Dana-Farber Cancer Institute, the podcast
                delivers candid, expert-level conversations on the most pressing
                developments in oncology—paired with real, unfiltered
                perspectives on life as practicing physicians navigating a
                rapidly evolving field.
              </p>
            </div>

            <button className="rounded-full bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-black">
              Sign Up
            </button>
          </div>

          {/* Right (speakers) */}
          <div className="grid grid-cols-2 gap-5">
            <SpeakerCard
              imageUrl="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80"
              name="Dr. Paolo Tarantino"
              practice="Name of Practice"
            />
            <SpeakerCard
              imageUrl="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=80"
              name="Dr. Jason Mouabbi"
              practice="Name of Practice"
            />
          </div>
        </div>
      </section>

      {/* =========================
          RESOURCES GRID
          ========================= */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-6">
          <div className="space-y-2">
            <h5 className="text-5xl md:text-6xl font-semibold text-gray-900">
              Resources
            </h5>
            <p className="text-sm text-gray-600">
              Lorem ipsum dolor sit amet consectetur.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {resources.map((r) => (
              <Link
                key={r.id}
                to={r.href}
                className={[
                  'relative rounded-2xl overflow-hidden min-h-[140px] md:min-h-[160px] border border-gray-200 group',
                  r.colSpan ? r.colSpan : '',
                ].join(' ')}
              >
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/35 group-hover:bg-black/45 transition-colors" />

                <div className="relative h-full p-4 flex items-start justify-between">
                  <p className="text-white font-semibold">{r.title}</p>
                  <span className="text-white/90">{'›'}</span>
                </div>

                <div className="relative h-full px-4 pb-4 flex items-end">
                  <div className="text-white/95">{r.icon}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          FAQ
          ========================= */}
      <section className="py-14">
        <div className="mx-auto max-w-7xl px-6 space-y-6">
          <h6 className="text-5xl md:text-6xl font-semibold text-gray-900">
            FAQ
          </h6>

          <div className="border-t border-gray-200">
            {Array.from({ length: 5 }).map((_, idx) => (
              <details
                key={idx}
                className="border-b border-gray-200 py-5 group"
              >
                <summary className="list-none flex items-center justify-between cursor-pointer">
                  <span className="text-base font-medium text-gray-900">
                    Lorem Ipsum
                  </span>
                  <span className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-600 max-w-3xl">
                  Placeholder answer content. Replace with real FAQ copy from
                  stakeholders.
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* =========================
          BRAND STATEMENT + CTA
          ========================= */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 text-center space-y-6">
          <p className="text-4xl md:text-6xl font-serif text-gray-900 leading-tight">
            A media company thats
            <br />
            about more than just
            <br />
            content
          </p>

          <Link
            to="/join"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-8 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            Join Us
          </Link>
        </div>
      </section>
    </div>
  );
}

function SpeakerCard({
  imageUrl,
  name,
  practice,
}: {
  imageUrl: string;
  name: string;
  practice: string;
}) {
  return (
    <div className="space-y-2">
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 h-[240px] md:h-[280px]">
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      </div>
      <p className="text-sm font-semibold text-gray-900">{name}</p>
      <p className="text-xs text-gray-600">{practice}</p>
    </div>
  );
}
