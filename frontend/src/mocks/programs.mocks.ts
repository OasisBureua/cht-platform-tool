import type { Program } from '../api/programs';

export const mockPrograms: Program[] = [
  {
    id: '123', // <-- makes /webinars/123 work for demos
    title: 'Featured Webinar',
    description: 'Emerging therapies and real-world outcomes in cardiometabolic care.',
    thumbnailUrl: '',
    creditAmount: 1.5,
    accreditationBody: 'ACCME',
    status: 'ACTIVE',
    sponsorName: 'Pfizer',
    sponsorLogo: '',
    honorariumAmount: 75,
    videos: [
      {
        id: 'vid-123-1',
        title: 'Introduction + Clinical Context',
        description: 'Overview of the learning objectives and patient scenario.',
        platform: 'YouTube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 11 * 60,
        order: 1,
      },
      {
        id: 'vid-123-2',
        title: 'Therapy Options and Guidelines',
        description: 'A practical approach to guideline-driven decision making.',
        platform: 'YouTube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 14 * 60,
        order: 2,
      },
    ],
  },
  {
    id: 'program-2',
    title: 'Oncology Update',
    description: 'Evidence review and treatment sequencing in metastatic disease.',
    thumbnailUrl: '',
    creditAmount: 1.0,
    accreditationBody: 'ACCME',
    status: 'ACTIVE',
    sponsorName: 'Novartis',
    sponsorLogo: '',
    honorariumAmount: 50,
    videos: [
      {
        id: 'vid-2-1',
        title: 'Case Review',
        description: 'Case-based learning with key takeaways.',
        platform: 'YouTube',
        videoId: 'dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: 9 * 60,
        order: 1,
      },
    ],
  },
];
