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
    try {
      const { data } = await apiClient.get<AdminProgram[]>('/admin/programs');
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return [];
      }
      throw err;
    }
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

  getPendingPayments: async () => {
    try {
      const { data } = await apiClient.get<PendingPayment[]>('/payments/pending');
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return [];
      }
      throw err;
    }
  },

  payNow: async (paymentId: string) => {
    const { data } = await apiClient.post(`/payments/${paymentId}/pay-now`);
    return data;
  },
};

export interface PendingPayment {
  id: string;
  userId: string;
  programId: string | null;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    billVendorId: string | null;
  };
  program: { id: string; title: string } | null;
}
