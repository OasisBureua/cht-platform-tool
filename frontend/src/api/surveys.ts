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
  jotformFormUrl?: string | null;

  createdAt: string;
  updatedAt: string;

  program?: {
    id: string;
    title: string;
    sponsorName?: string;
    honorariumAmount?: number | null;
    creditAmount?: number | null;
    zoomSessionType?: string;
    startDate?: string | null;
  };
}

const ENABLE_MOCK_FALLBACK = import.meta.env.DEV;

export const surveysApi = {
  getAll: async (): Promise<Survey[]> => {
    try {
      const { data } = await apiClient.get('/surveys');
      return Array.isArray(data) && data.length > 0 ? data : (ENABLE_MOCK_FALLBACK ? mockSurveys : []);
    } catch {
      if (ENABLE_MOCK_FALLBACK) return mockSurveys;
      throw new Error('Failed to load surveys');
    }
  },

  getById: async (id: string): Promise<Survey> => {
    try {
      const { data } = await apiClient.get(`/surveys/${id}`);
      return data;
    } catch {
      if (ENABLE_MOCK_FALLBACK) {
        const survey = mockSurveys.find((s) => s.id === id);
        if (survey) return survey;
      }
      throw new Error('Survey not found');
    }
  },

  submitResponse: async (id: string, payload: { userId: string; answers: Record<string, unknown> }) => {
    const { data } = await apiClient.post(`/surveys/${id}/responses`, {
      answers: payload.answers,
    });
    return data;
  },

  /** Auth required. Reflects Jotform webhook-created rows as well as native submit. */
  getMyResponse: async (
    id: string,
  ): Promise<{ submitted: boolean; responseId?: string; submittedAt?: string }> => {
    const { data } = await apiClient.get(`/surveys/${id}/my-response`);
    return data;
  },

  getJotformResume: async (surveyId: string): Promise<{ sessionId: string; expiresAt: string } | null> => {
    const { data } = await apiClient.get(`/surveys/${surveyId}/jotform-resume`);
    return data ?? null;
  },

  putJotformResume: async (surveyId: string, sessionId: string): Promise<void> => {
    await apiClient.put(`/surveys/${surveyId}/jotform-resume`, { sessionId });
  },
};
