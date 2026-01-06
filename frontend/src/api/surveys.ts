import { mockSurveys } from '../mocks/surveys.mock';

export type SurveyType = 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';

export interface Survey {
  id: string;
  programId: string;
  title: string;
  description?: string | null;
  questions: any;
  type: SurveyType;
  required: boolean;

  jotformFormId?: string | null;

  createdAt: string;
  updatedAt: string;

  program?: {
    id: string;
    title: string;
    sponsorName?: string;
  };
}

/**
 * MOCK-ONLY API
 * Backend surveys module does not exist yet.
 */
export const surveysApi = {
  getAll: async (): Promise<Survey[]> => {
    return mockSurveys;
  },

  getById: async (id: string): Promise<Survey> => {
    const survey = mockSurveys.find((s) => s.id === id);
    if (!survey) {
      throw new Error('Survey not found (mock)');
    }
    return survey;
  },

  submitResponse: async () => {
    // UI-only success
    return { success: true };
  },
};
