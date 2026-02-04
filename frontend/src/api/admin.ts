import apiClient from './client';

export interface AdminProgram {
  id: string;
  title: string;
  description: string;
  sponsorName: string;
  sponsorLogo?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  creditAmount: number;
  honorariumAmount?: number;
  startDate?: string;
  endDate?: string;
  enrollmentsCount: number;
  surveysCount: number;
}

export interface CreateProgramPayload {
  title: string;
  description: string;
  sponsorName: string;
  sponsorLogo?: string;
  creditAmount?: number;
  accreditationBody?: string;
  status?: 'DRAFT' | 'PUBLISHED';
  honorariumAmount?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreateSurveyPayload {
  programId: string;
  title: string;
  description?: string;
  questions: Record<string, unknown>[];
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
  required?: boolean;
}

export const adminApi = {
  getPrograms: async (): Promise<AdminProgram[]> => {
    const { data } = await apiClient.get<AdminProgram[]>('/admin/programs');
    return data;
  },

  createProgram: async (payload: CreateProgramPayload) => {
    const { data } = await apiClient.post('/admin/programs', payload);
    return data;
  },

  updateProgramStatus: async (id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => {
    const { data } = await apiClient.patch(`/admin/programs/${id}/status`, { status });
    return data;
  },

  createSurvey: async (payload: CreateSurveyPayload) => {
    const { data } = await apiClient.post('/admin/surveys', payload);
    return data;
  },
};
