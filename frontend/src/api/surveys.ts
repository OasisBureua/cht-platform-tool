import apiClient from './client';
import { mockSurveys } from '../mocks/surveys.mock';

export type SurveyType = 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK' | 'INTAKE';

export interface SurveyQuestion {
  id?: string;
  type?: string;
  prompt?: string;
  options?: string[];
  maxSelections?: number;
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
  questions: unknown;
  type: SurveyType;
  required: boolean;
  isCustomized?: boolean;
  /** Monotonic native schema revision; stamped onto each response at submit. */
  schemaVersion?: number;
  /** Admin-only count used to explain response-safe editing constraints. */
  responseCount?: number;

  jotformFormId?: string | null;
  jotformFormUrl?: string | null;

  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  program?: {
    id: string;
    title: string;
    sponsorName?: string;
    /** Cents in DB / surveys API (same as Prisma). */
    honorariumAmount?: number | null;
    creditAmount?: number | null;
    zoomSessionType?: string;
    startDate?: string | null;
    duration?: number | null;
    zoomSessionEndedAt?: string | null;
  };
}

const ENABLE_MOCK_FALLBACK = import.meta.env.DEV;

export type SurveyListResponse = {
  active: Survey[];
  completed: Survey[];
};

function normalizeSurveyList(data: unknown): SurveyListResponse {
  if (Array.isArray(data)) {
    return { active: data as Survey[], completed: [] };
  }
  const obj = data as SurveyListResponse | null | undefined;
  return {
    active: obj?.active ?? [],
    completed: obj?.completed ?? [],
  };
}

export const surveysApi = {
  getAll: async (): Promise<SurveyListResponse> => {
    try {
      const { data } = await apiClient.get('/surveys');
      const list = normalizeSurveyList(data);
      if (list.active.length > 0 || list.completed.length > 0) {
        return list;
      }
      return ENABLE_MOCK_FALLBACK
        ? { active: mockSurveys, completed: [] }
        : list;
    } catch {
      if (ENABLE_MOCK_FALLBACK) {
        return { active: mockSurveys, completed: [] };
      }
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

  submitResponse: async (id: string, payload: { answers: Record<string, unknown> }) => {
    const { data } = await apiClient.post(`/surveys/${id}/responses`, {
      answers: payload.answers,
    });
    return data as { id: string; submissionId?: string; submittedAt: string };
  },

  /** Auth required. Reflects webhook-created rows as well as native submit. */
  getMyResponse: async (
    id: string,
  ): Promise<{ submitted: boolean; responseId?: string; submissionId?: string; submittedAt?: string }> => {
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
