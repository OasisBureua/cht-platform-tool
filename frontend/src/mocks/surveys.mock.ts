import type { Survey } from '../api/surveys';

export const mockSurveys: Survey[] = [
  {
    id: 'seed-survey-1',
    programId: 'seed-program-1',
    title: 'Cardiology Treatment Feedback',
    description: 'Share your feedback on this activity.',
    type: 'FEEDBACK',
    required: true,
    questions: {
      questions: [
        {
          id: 'q1',
          type: 'single_choice',
          prompt: 'How valuable was this activity?',
          options: ['Low', 'Medium', 'High'],
          required: true,
        },
        {
          id: 'q2',
          type: 'text',
          prompt: 'Any additional comments?',
        },
      ],
    },
    jotformFormId: '260624911991966', // 2/18 Post Event Survey - communityhealthmedia.jotform.com
    jotformFormUrl: 'https://communityhealthmedia.jotform.com/260624911991966',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    program: {
      id: 'seed-program-1',
      title: 'Cardiology Treatment Webinar',
      sponsorName: 'Pfizer',
      honorariumAmount: 35_000,
    },
  },
  {
    id: 'survey-2',
    programId: 'program-2',
    title: 'Oncology Program Feedback',
    description: 'Help us improve future educational activities.',
    type: 'FEEDBACK',
    required: false,
    questions: {
      questions: [
        {
          id: 'q1',
          type: 'text',
          prompt: 'What was the most valuable part of this activity?',
        },
      ],
    },
    jotformFormId: '240123456789012',
    jotformFormUrl: 'https://communityhealthmedia.jotform.com/240123456789012',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    program: {
      id: 'program-2',
      title: 'Advances in Oncology',
      sponsorName: 'Novartis',
      honorariumAmount: 50_000,
    },
  },
];
