import apiClient from './client';
import { mockSurveys } from '../mocks/surveys.mock';

export type SurveyType = 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';

export interface SurveyQuestion {
  id?: string;
  type?: string;
  prompt?: string;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  required?: boolean;
  [key: string]: unknown;
}

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

export const surveysApi = {
  getAll: async (): Promise<Survey[]> => {
    try {
      const { data } = await apiClient.get('/surveys');
      return Array.isArray(data) && data.length > 0 ? data : mockSurveys;
    } catch {
      return mockSurveys;
    }
  },

  getById: async (id: string): Promise<Survey> => {
    try {
      const { data } = await apiClient.get(`/surveys/${id}`);
      return data;
    } catch {
      const survey = mockSurveys.find((s) => s.id === id);
      if (!survey) throw new Error('Survey not found');
      return survey;
    }
  },

  submitResponse: async (id: string, payload: { userId: string; answers: Record<string, unknown> }) => {
    const { data } = await apiClient.post(`/surveys/${id}/responses`, {
      answers: payload.answers,
    });
    return data;
  },
};
