/** In-app podcast catalog (static until a feed/API exists). */

export type PodcastEpisode = {
  num: string;
  title: string;
  guests: string;
  date: string;
  dateIso: string;
  duration: string;
  description?: string;
};

export type PodcastShow = {
  id: string;
  title: string;
  tagline: string;
  image: string;
  /** Row like Apple’s category line */
  category: string;
  /** e.g. “Updated weekly”, “New season” */
  updateNote: string;
  episodes: PodcastEpisode[];
};

export const PODCAST_SHOWS: PodcastShow[] = [
  {
    id: 'breast-friends',
    title: 'Breast Friends',
    tagline:
      'Direct, expert-led conversations about breast cancer, built for patients and clinicians. We pair first-line data with what it feels like in the exam room and at home.',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    category: 'Clinical · Oncology',
    updateNote: 'Updated monthly',
    episodes: [
      {
        num: 'Ep 1',
        title: 'Welcome to Breast Friends: Why This Podcast Exists',
        guests: 'Community Health Media',
        date: 'Oct 22, 2025',
        dateIso: '2025-10-22',
        duration: '18 min',
        description:
          'The first episode lays out the goal: expert oncology talk that anyone in breast cancer can actually use, without the jargon wall.',
      },
      {
        num: 'Ep 2',
        title: 'Navigating Your First Diagnosis',
        guests: 'Community Health Media',
        date: 'Nov 4, 2025',
        dateIso: '2025-11-04',
        duration: '38 min',
        description:
          'Questions to bring to your team, how to read a pathology report, and what HER2+ means for your case.',
      },
      {
        num: 'Ep 3',
        title: 'Treatment Options Demystified',
        guests: 'Community Health Media',
        date: 'Nov 18, 2025',
        dateIso: '2025-11-18',
        duration: '42 min',
        description: 'Surgery, radiation, and systemic therapy in plain language, with no sales pitch.',
      },
    ],
  },
  {
    id: 'practice-change',
    title: 'Practice Change Pulse',
    tagline:
      'Short runs on how evidence moves into real-world care: pathways, payer reality, and what changed in the last guideline cycle.',
    image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    category: 'Professional · Practice',
    updateNote: 'Biweekly',
    episodes: [
      {
        num: 'Ep 1',
        title: 'From Trial to Clinic: One Pathway at a Time',
        guests: 'CHM Editorial',
        date: 'Jan 8, 2026',
        dateIso: '2026-01-08',
        duration: '24 min',
        description: 'How multidisciplinary teams convert a readout into a workflow patients can navigate.',
      },
      {
        num: 'Ep 2',
        title: 'Prior Auth Without the Panic',
        guests: 'CHM Editorial',
        date: 'Jan 22, 2026',
        dateIso: '2026-01-22',
        duration: '31 min',
        description: 'Templates, documentation, and timing that keep appeals out of the critical path.',
      },
    ],
  },
  {
    id: 'office-side',
    title: 'Office Hours Side Sessions',
    tagline:
      'Extended Q&A lifted from CHM live sessions: deeper dives your team can replay between conferences.',
    /** Same stock stack as elsewhere in the app; replace with Q&A-specific art when licensed. */
    image: '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
    category: 'Education · Q&A',
    updateNote: 'Updated after each Office Hours',
    episodes: [
      {
        num: 'Bonus 1',
        title: 'Staging Questions Oncologists Hear Every Week',
        guests: 'Live audience',
        date: 'Dec 2, 2025',
        dateIso: '2025-12-02',
        duration: '46 min',
        description: 'A rhythm for tough conversations, follow-up imaging, and shared decision-making moments.',
      },
    ],
  },
];

export const UPCOMING_PLACEHOLDER = {
  id: 'coming-soon-1',
  title: 'More series',
  tagline:
    'We are recording new disease-area shows and short-run seasons. When they ship, you will see them here first.',
  image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
} as const;
