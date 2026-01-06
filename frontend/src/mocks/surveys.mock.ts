import type { Survey } from '../api/surveys';

export const mockSurveys: Survey[] = [
  {
    id: 'survey-1',
    programId: 'program-1',
    title: 'Cardiology Treatment Pre-Test',
    description: 'Assess baseline knowledge before participating.',
    type: 'PRE_TEST',
    required: true,
    questions: {
      questions: [
        {
          id: 'q1',
          type: 'single_choice',
          prompt: 'How often do you prescribe beta blockers?',
          options: ['Never', 'Rarely', 'Sometimes', 'Often'],
          required: true,
        },
        {
          id: 'q2',
          type: 'rating',
          prompt: 'How familiar are you with current guidelines?',
          scaleMin: 1,
          scaleMax: 5,
        },
      ],
    },
    jotformFormId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    program: {
      id: 'program-1',
      title: 'Modern Cardiology Webinar',
      sponsorName: 'Pfizer',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    program: {
      id: 'program-2',
      title: 'Advances in Oncology',
      sponsorName: 'Novartis',
    },
  },
];
