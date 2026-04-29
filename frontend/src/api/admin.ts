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

export type ZoomSessionType = 'WEBINAR' | 'MEETING';

export interface AdminWebinar {
  id: string;
  title: string;
  description: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  startDate: string | null;
  duration: number | null;
  /** Defaults to WEBINAR when omitted (legacy programs). */
  zoomSessionType?: ZoomSessionType;
  zoomMeetingId: string | null;
  zoomJoinUrl: string | null;
  zoomStartUrl: string | null;
  sponsorName: string;
  creditAmount: number;
  /** USD; webinars only (Office Hours sessions omit this). */
  honorariumAmount?: number;
  createdAt: string;
}

export interface CreateWebinarPayload {
  title: string;
  description?: string;
  sponsorName?: string;
  startDate: string;
  duration: number;
  timezone?: string;
  /** WEBINAR = Zoom Webinar + Jotform invitation & post-event clones from env; MEETING = Office Hours. */
  zoomSessionType?: ZoomSessionType;
  status?: 'DRAFT' | 'PUBLISHED';
  /**
   * Optional Jotform form ID or URL for the post-event (FEEDBACK) survey.
   * Saved to the program and listed under Surveys for learners.
   */
  postEventJotformFormIdOrUrl?: string;
  /**
   * Optional (WEBINAR). Full Jotform form URL for registration / intake.
   * When set, skips automatic invitation clone from env for this session.
   */
  jotformIntakeFormUrl?: string;
  /**
   * Optional. Honorarium in USD for learners (paid via Bill.com after post-event flow). WEBINAR only.
   */
  honorariumAmount?: number;
}

export interface UpdateWebinarPayload {
  title?: string;
  description?: string;
  sponsorName?: string;
  startDate?: string;
  duration?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  /** WEBINAR only. USD; use 0 to clear. */
  honorariumAmount?: number;
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

  getAdminConfig: async (): Promise<{
    jotformInvitationTemplateFormId: string;
    jotformPostEventTemplateFormId: string;
    jotformPostEventSharedFormId: string;
    jotformTemplateFormId: string;
    webinarJotformTemplatesConfigured: boolean;
  }> => {
    const { data } = await apiClient.get('/admin/config');
    return data as {
      jotformInvitationTemplateFormId: string;
      jotformPostEventTemplateFormId: string;
      jotformPostEventSharedFormId: string;
      jotformTemplateFormId: string;
      webinarJotformTemplatesConfigured: boolean;
    };
  },

  // ─── Webinar CRUD (Zoom-backed) ──────────────────────────────────────────

  getWebinars: async (params?: { zoomSessionType?: ZoomSessionType }): Promise<AdminWebinar[]> => {
    try {
      const { data } = await apiClient.get<AdminWebinar[]>('/admin/webinars', { params });
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return [];
      }
      throw err;
    }
  },

  createWebinar: async (
    payload: CreateWebinarPayload,
  ): Promise<AdminWebinar & { zoomWarning?: string; jotformFormsWarning?: string }> => {
    const { data } = await apiClient.post<AdminWebinar & { zoomWarning?: string; jotformFormsWarning?: string }>(
      '/admin/webinars',
      payload,
    );
    return data;
  },

  updateWebinar: async (id: string, payload: UpdateWebinarPayload): Promise<AdminWebinar> => {
    const { data } = await apiClient.patch<AdminWebinar>(`/admin/webinars/${id}`, payload);
    return data;
  },

  deleteWebinar: async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/webinars/${id}`);
  },

  getProgram: async (id: string): Promise<Record<string, unknown>> => {
    const { data } = await apiClient.get(`/admin/programs/${encodeURIComponent(id)}`);
    return data;
  },

  patchProgramRegistrationSettings: async (
    id: string,
    body: {
      jotformIntakeFormUrl?: string | null;
      jotformPreEventUrl?: string | null;
      hostDisplayName?: string | null;
      registrationRequiresApproval?: boolean;
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/programs/${encodeURIComponent(id)}/registration-settings`, body);
    return data;
  },

  listProgramRegistrations: async (programId: string) => {
    const { data } = await apiClient.get(`/admin/programs/${encodeURIComponent(programId)}/registrations`);
    return data as Array<{
      id: string;
      status: string;
      createdAt: string;
      updatedAt?: string;
      lastSubmittedAt?: string;
      intakeJotformSubmissionId?: string | null;
      intakeRequired?: boolean;
      intakeComplete?: boolean;
      jotformIntakeSubmissionViewUrl?: string | null;
      postEventJotformSubmissionId?: string | null;
      jotformPostEventSubmissionViewUrl?: string | null;
      postEventSurveyAcknowledgedAt?: string | null;
      user: { id: string; email: string; firstName: string; lastName: string };
      slot: { id: string; startsAt: string; endsAt: string; label: string | null } | null;
    }>;
  },

  listProgramEnrollments: async (programId: string) => {
    const { data } = await apiClient.get(`/admin/programs/${encodeURIComponent(programId)}/enrollments`);
    return data as Array<{
      id: string;
      enrolledAt: string;
      completed: boolean;
      overallProgress: number;
      user: { id: string; email: string; firstName: string; lastName: string; specialty?: string | null };
    }>;
  },

  listPendingPostEventAttendance: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/pending-attendance');
    return data as Array<{
      id: string;
      postEventAttendanceStatus: string;
      createdAt: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        specialty?: string | null;
        institution?: string | null;
        city?: string | null;
      };
      program: {
        id: string;
        title: string;
        zoomSessionType?: 'WEBINAR' | 'MEETING';
        startDate?: string | null;
        zoomJoinUrl?: string | null;
      };
    }>;
  },

  updatePostEventAttendance: async (registrationId: string, status: 'VERIFIED' | 'DENIED') => {
    const { data } = await apiClient.patch(
      `/admin/registrations/${encodeURIComponent(registrationId)}/post-event-attendance`,
      { status },
    );
    return data;
  },

  listPendingWebinarRegistrations: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/pending');
    return data as Array<{
      id: string;
      status: string;
      createdAt: string;
      updatedAt?: string;
      /** Max(createdAt, updatedAt, intake submitted) — use for “last request” after resubmits */
      lastSubmittedAt?: string;
      intakeJotformSubmissionId: string | null;
      intakeRequired: boolean;
      intakeComplete: boolean;
      jotformIntakeSubmissionViewUrl?: string | null;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        specialty?: string | null;
        institution?: string | null;
        city?: string | null;
      };
      program: {
        id: string;
        title: string;
        jotformIntakeFormUrl: string | null;
        zoomSessionType?: 'WEBINAR' | 'MEETING';
        zoomJoinUrl?: string | null;
        startDate?: string | null;
        duration?: number | null;
      };
    }>;
  },

  updateProgramRegistration: async (
    registrationId: string,
    body: {
      status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED';
      adminNotes?: string | null;
      /** When status is REJECTED, controls rejection email copy (Live / Office Hours). */
      rejectEmailReason?: 'GENERIC' | 'INCOMPLETE_INTAKE';
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/registrations/${encodeURIComponent(registrationId)}`, body);
    return data;
  },

  removeProgramEnrollment: async (programId: string, enrollmentId: string) => {
    const { data } = await apiClient.delete(
      `/admin/programs/${encodeURIComponent(programId)}/enrollments/${encodeURIComponent(enrollmentId)}`,
    );
    return data as { removed: boolean };
  },

  downloadRegistrationIcsBlob: async (registrationId: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/admin/registrations/${encodeURIComponent(registrationId)}/ics`,
      { responseType: 'blob' },
    );
    return data;
  },

  markRegistrationCalendarSent: async (registrationId: string) => {
    const { data } = await apiClient.post(
      `/admin/registrations/${encodeURIComponent(registrationId)}/mark-calendar-sent`,
    );
    return data;
  },

  createOfficeHoursSlot: async (
    programId: string,
    body: { startsAt: string; endsAt: string; label?: string; maxAttendees?: number; sortOrder?: number },
  ) => {
    const { data } = await apiClient.post(`/admin/programs/${encodeURIComponent(programId)}/slots`, body);
    return data;
  },

  deleteOfficeHoursSlot: async (programId: string, slotId: string) => {
    const { data } = await apiClient.delete(
      `/admin/programs/${encodeURIComponent(programId)}/slots/${encodeURIComponent(slotId)}`,
    );
    return data;
  },

  listProgramFormLinks: async (programId: string) => {
    const { data } = await apiClient.get(`/admin/programs/${encodeURIComponent(programId)}/form-links`);
    return data as Array<{ id: string; kind: string; label: string; jotformUrl: string; sortOrder: number }>;
  },

  addProgramFormLink: async (
    programId: string,
    body: { kind: 'INTAKE' | 'PRE_EVENT' | 'POST_EVENT' | 'CUSTOM'; label: string; jotformUrl: string; sortOrder?: number },
  ) => {
    const { data } = await apiClient.post(`/admin/programs/${encodeURIComponent(programId)}/form-links`, body);
    return data;
  },

  deleteProgramFormLink: async (linkId: string) => {
    const { data } = await apiClient.delete(`/admin/program-form-links/${encodeURIComponent(linkId)}`);
    return data;
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

  /** HCP/KOL only; backend rejects ADMIN and self-delete. */
  deleteUser: async (userId: string): Promise<{ deleted: boolean; id: string }> => {
    const { data } = await apiClient.delete(`/admin/users/${encodeURIComponent(userId)}`);
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
