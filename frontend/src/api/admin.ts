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

export interface AdminWebinar {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  startDate: string | null;
  duration: number | null;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  sponsorName: string;
  creditAmount: number;
  createdAt: string;
}

export interface CreateWebinarPayload {
  title: string;
  description?: string;
  sponsorName?: string;
  startDate: string;
  duration: number;
  timezone?: string;
  createSurveyFromTemplate?: string;
  status?: 'DRAFT' | 'PUBLISHED';
}

export interface UpdateWebinarPayload {
  title?: string;
  description?: string;
  sponsorName?: string;
  startDate?: string;
  duration?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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
  /** Jotform template form ID – when set, clones form, adds webhook, creates Survey */
  createSurveyFromTemplate?: string;
}

export interface CreateSurveyPayload {
  programId: string;
  title: string;
  description?: string;
  questions: Record<string, unknown>[];
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
  required?: boolean;
  /** Link to an existing Jotform form. When set, the survey will embed this form and receive webhook submissions. */
  jotformFormId?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'HCP' | 'KOL' | 'ADMIN';
  status: string;
  createdAt: string;
}

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

export interface AdminStats {
  activeHcpsCount: number;
  activeHcpsCountPreviousWeek: number;
  paymentsPaidCount: number;
}

export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    try {
      const { data } = await apiClient.get<AdminStats>('/admin/stats');
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return { activeHcpsCount: 0, activeHcpsCountPreviousWeek: 0, paymentsPaidCount: 0 };
      }
      throw err;
    }
  },

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

  updateSurvey: async (id: string, payload: { jotformFormId?: string }) => {
    const { data } = await apiClient.patch(`/admin/surveys/${id}`, payload);
    return data;
  },

  deleteSurvey: async (id: string) => {
    await apiClient.delete(`/admin/surveys/${id}`);
  },

  getAdminConfig: async (): Promise<{ jotformTemplateFormId: string }> => {
    const { data } = await apiClient.get('/admin/config');
    return data;
  },

  // ─── Webinar CRUD (Zoom-backed) ──────────────────────────────────────────

  getWebinars: async (): Promise<AdminWebinar[]> => {
    try {
      const { data } = await apiClient.get<AdminWebinar[]>('/admin/webinars');
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return [];
      }
      throw err;
    }
  },

  createWebinar: async (payload: CreateWebinarPayload): Promise<AdminWebinar> => {
    const { data } = await apiClient.post<AdminWebinar>('/admin/webinars', payload);
    return data;
  },

  updateWebinar: async (id: string, payload: UpdateWebinarPayload): Promise<AdminWebinar> => {
    const { data } = await apiClient.patch<AdminWebinar>(`/admin/webinars/${id}`, payload);
    return data;
  },

  deleteWebinar: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/webinars/${id}`);
  },

  // ─── Users ───────────────────────────────────────────────────────────────

  getUsers: async (params?: { q?: string; role?: string; limit?: number }): Promise<AdminUser[]> => {
    const { data } = await apiClient.get<AdminUser[]>('/admin/users', { params });
    return data;
  },

  updateUserRole: async (userId: string, role: 'HCP' | 'KOL' | 'ADMIN') => {
    const { data } = await apiClient.patch(`/admin/users/${userId}/role`, { role });
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

  deletePayment: async (paymentId: string) => {
    const { data } = await apiClient.delete(`/payments/${paymentId}`);
    return data;
  },
};
