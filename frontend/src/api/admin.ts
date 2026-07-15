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

export interface ZoomPanelistLink {
  name: string;
  email: string;
  joinUrl: string;
}

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
  /** Persisted panelist join URLs (Host + Speakers + CHM Staff). Available in list after creation. */
  zoomPanelistLinks?: ZoomPanelistLink[];
  /** Present when panelists were attempted but URLs could not be generated (scope issue, plan issue, etc.). */
  zoomPanelistError?: string;
  hostDisplayName?: string;
  hostBio?: string;
  speakers?: string[];
  /** True when this program was auto-created by a Zoom webhook (webinar.created). */
  importedViaWebhook?: boolean;
  /** Zoom session exists on the account but is not linked to a platform program yet. */
  unlinkedFromZoom?: boolean;
  /** Shown to learners on registration and session detail */
  sessionDisclaimer?: string;
  /** Banner image URL for session pages */
  sessionHeroImageUrl?: string;
}

export interface CreateWebinarPayload {
  title: string;
  description?: string;
  sponsorName?: string;
  startDate: string;
  duration: number;
  timezone?: string;
  /** WEBINAR = Zoom Webinar + native intake/post-event surveys; MEETING = Office Hours. */
  zoomSessionType?: ZoomSessionType;
  status?: 'DRAFT' | 'PUBLISHED';
  /**
   * Optional. Honorarium in USD for learners (paid via Bill.com after post-event flow). WEBINAR only.
   */
  honorariumAmount?: number;
  /** Primary speaker / KOL display name. */
  hostDisplayName?: string;
  /** Short speaker bio shown on the program detail page. */
  hostBio?: string;
  /**
   * Optional (WEBINAR). Speaker/KOL display names.
   * Each gets a unique panelist join link (zsoccerguy+user1@gmail.com, +user2, …).
   * CHM Staff is always added as a panelist automatically.
   */
  speakers?: string[];
  /** Optional text disclaimer for learners (registration + detail). */
  sessionDisclaimer?: string;
  /** Optional HTTPS image URL for session branding. */
  sessionHeroImageUrl?: string;
}

export interface UpdateWebinarPayload {
  title?: string;
  description?: string;
  sponsorName?: string;
  startDate?: string;
  duration?: number;
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  /** Live vs Office Hours listing; choose the type that matches the Zoom Webinar vs Meeting in Zoom. */
  zoomSessionType?: ZoomSessionType;
  /** WEBINAR only. USD; use 0 to clear. */
  honorariumAmount?: number;
  hostDisplayName?: string;
  hostBio?: string;
  speakers?: string[];
  sessionDisclaimer?: string | null;
  sessionHeroImageUrl?: string | null;
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
  /** US state or region when captured on profile */
  state?: string | null;
  createdAt: string;
}

export interface AdminUserPaidPayment {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  paidAt: string | null;
  programId: string | null;
  program: { title: string } | null;
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

export interface FailedPayment extends PendingPayment {
  failedAt: string | null;
  failureReason: string | null;
}

/** Recent successful payouts on admin Payments page */
export interface PaidPayment extends PendingPayment {
  paidAt: string | null;
}

export interface AdminStats {
  activeHcpsCount: number;
  activeHcpsCountPreviousWeek: number;
  paymentsPaidCount: number;
}

export interface WebhookImportedProgram {
  id: string;
  title: string;
  startDate: string | null;
  createdAt: string;
  missingFields: string[];
}

export interface ProgramRegistrationAdminRow {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  lastSubmittedAt?: string;
  intakeSubmissionId?: string | null;
  intakeRequired?: boolean;
  intakeComplete?: boolean;
  jotformIntakeSubmissionViewUrl?: string | null;
  postEventSurveySubmitted?: boolean;
  postEventSurveyResponseId?: string | null;
  postEventSurveyAnswers?: Record<string, unknown> | null;
  postEventSurveySubmittedAt?: string | null;
  intakeSurveyResponseId?: string | null;
  intakeSurveyAnswers?: Record<string, unknown> | null;
  intakeSurveySubmittedAt?: string | null;
  postEventJotformSubmissionId?: string | null;
  jotformPostEventSubmissionViewUrl?: string | null;
  postEventSurveyAcknowledgedAt?: string | null;
  postEventAttendanceStatus?: string | null;
  postEventAttendanceReviewedAt?: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
  slot: { id: string; startsAt: string; endsAt: string; label: string | null } | null;
}

export interface PostEventAttendanceAdminRow {
  id: string;
  status: string;
  postEventAttendanceStatus: string;
  postEventAttendanceReviewedAt?: string | null;
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
}

// ── Survey response analytics (mirrors backend survey-analytics.dto.ts) ──────
// See docs/engineering/survey-response-analytics-api.md for the full contract.

export type SurveyAnalyticsQuestionKind = 'choice' | 'rating' | 'text';
export type SurveySegmentDimension = 'specialty' | 'status' | 'attendance';

export interface SurveyChoiceOptionCount {
  label: string;
  count: number;
  /** Share of respondents who answered (0–100). Multi-select can sum above 100. */
  percentage: number;
}

export interface SurveyHistogramBucket {
  value: number;
  count: number;
}

export interface SurveyNumericStats {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  histogram: SurveyHistogramBucket[];
}

interface SurveyQuestionAnalyticsBase {
  id: string;
  prompt: string;
  /** Native schema type, or 'unknown' for inferred keys. */
  type: string;
  kind: SurveyAnalyticsQuestionKind;
  /** True when inferred from data (no native schema type). */
  inferred?: boolean;
}

export interface SurveyChoiceQuestionAnalytics
  extends SurveyQuestionAnalyticsBase {
  kind: 'choice';
  multiSelect: boolean;
  maxSelections?: number;
  totalAnswered: number;
  options: SurveyChoiceOptionCount[];
}

export interface SurveyRatingQuestionAnalytics
  extends SurveyQuestionAnalyticsBase,
    SurveyNumericStats {
  kind: 'rating';
}

export interface SurveyTextQuestionAnalytics
  extends SurveyQuestionAnalyticsBase {
  kind: 'text';
  responseCount: number;
  /** Empty unless the request opted into redacted samples. */
  samples: string[];
}

export type SurveyQuestionAnalytics =
  | SurveyChoiceQuestionAnalytics
  | SurveyRatingQuestionAnalytics
  | SurveyTextQuestionAnalytics;

export interface SurveyAnalyticsCompletionRate {
  eligible: number;
  completed: number;
  rate: number;
}

export interface SurveyAnalyticsTotals {
  totalResponses: number;
  uniqueRespondents: number;
  firstResponseAt: string | null;
  lastResponseAt: string | null;
  /** Null for INTAKE and program-less surveys. */
  completionRate: SurveyAnalyticsCompletionRate | null;
  /** Response-level score summary (test surveys); null when no numeric scores. */
  score: SurveyNumericStats | null;
}

export interface SurveyAnalyticsTimeSeriesPoint {
  /** UTC day, YYYY-MM-DD. Only days with responses appear. */
  date: string;
  count: number;
}

export interface SurveyAnalyticsSegmentGroup {
  /** Raw segment value ('unknown' when missing/empty). */
  key: string;
  /** Display label ('Unknown' for the missing bucket). */
  label: string;
  totalResponses: number;
  /** Counts-only aggregates for this segment (no free-text samples). */
  questions: SurveyQuestionAnalytics[];
}

export interface SurveyAnalyticsSegmentBreakdown {
  dimension: SurveySegmentDimension;
  groups: SurveyAnalyticsSegmentGroup[];
}

export interface SurveyResponseAnalytics {
  surveyType: string;
  hasNativeSchema: boolean;
  totals: SurveyAnalyticsTotals;
  timeSeries: SurveyAnalyticsTimeSeriesPoint[];
  questions: SurveyQuestionAnalytics[];
  /** Present when segmentBy was provided; otherwise null. */
  segments: SurveyAnalyticsSegmentBreakdown | null;
}

export interface SurveyAnalyticsSummary {
  id: string;
  title: string;
  type: string;
  program: { id: string; title: string } | null;
}

export interface SurveyAnalytics {
  survey: SurveyAnalyticsSummary;
  analytics: SurveyResponseAnalytics;
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
    zoomConfigured: boolean;
    sessionHeroUploadEnabled: boolean;
  }> => {
    const { data } = await apiClient.get('/admin/config');
    return data as {
      jotformInvitationTemplateFormId: string;
      jotformPostEventTemplateFormId: string;
      jotformPostEventSharedFormId: string;
      jotformTemplateFormId: string;
      webinarJotformTemplatesConfigured: boolean;
      zoomConfigured: boolean;
      sessionHeroUploadEnabled: boolean;
    };
  },

  presignSessionHeroUpload: async (body: {
    contentType: string;
    contentLength: number;
    fileName?: string;
  }): Promise<{ uploadUrl: string; publicUrl: string; key: string }> => {
    const { data } = await apiClient.post<{ uploadUrl: string; publicUrl: string; key: string }>(
      '/admin/uploads/session-hero/presign',
      body,
    );
    return data;
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
  ): Promise<AdminWebinar & { zoomWarning?: string; surveysWarning?: string }> => {
    const { data } = await apiClient.post<AdminWebinar & { zoomWarning?: string; surveysWarning?: string }>(
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

  importFromZoom: async (body: {
    zoomId: string;
    zoomSessionType?: ZoomSessionType;
    sponsorName?: string;
  }): Promise<AdminWebinar & { surveysWarning?: string }> => {
    const { data } = await apiClient.post<AdminWebinar & { surveysWarning?: string }>(
      '/admin/webinars/import-from-zoom',
      body,
    );
    return data;
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
    const payload = data as
      | {
          registrations: Array<ProgramRegistrationAdminRow>;
          surveys?: {
            intake?: { id: string; questions: unknown } | null;
            feedback?: { id: string; questions: unknown } | null;
          };
        }
      | ProgramRegistrationAdminRow[];
    if (Array.isArray(payload)) {
      return {
        registrations: payload,
        surveys: { intake: null, feedback: null },
      };
    }
    return {
      registrations: payload.registrations ?? [],
      surveys: payload.surveys ?? { intake: null, feedback: null },
    };
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

  listPaymentEligibleNotYetRequested: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/payment-eligible');
    return data as Array<{
      id: string;
      postEventSurveyAcknowledgedAt: string | null;
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
        honorariumAmount: number | null;
        zoomSessionType?: 'WEBINAR' | 'MEETING';
        startDate?: string | null;
      };
    }>;
  },

  listPendingPostEventAttendance: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/pending-attendance');
    return data as PostEventAttendanceAdminRow[];
  },

  listPostEventAttendance: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/attendance');
    return data as PostEventAttendanceAdminRow[];
  },

  listSurveyResponses: async (surveyId: string) => {
    const { data } = await apiClient.get(`/admin/surveys/${encodeURIComponent(surveyId)}/responses`);
    return data as {
      survey: {
        id: string;
        title: string;
        type: string;
        questions: unknown;
        program?: { id: string; title: string } | null;
      };
      responses: Array<{
        id: string;
        submissionId: string | null;
        submittedAt: string;
        answers: Record<string, unknown>;
        user: {
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          specialty?: string | null;
        };
        registration: {
          status: string;
          postEventAttendanceStatus: string;
        } | null;
      }>;
    };
  },

  downloadSurveyResponsesCsv: async (surveyId: string): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>(
      `/admin/surveys/${encodeURIComponent(surveyId)}/responses.csv`,
      { responseType: 'blob' },
    );
    return data;
  },

  getSurveyAnalytics: async (
    surveyId: string,
    opts: { segmentBy?: SurveySegmentDimension; includeSamples?: boolean } = {},
  ): Promise<SurveyAnalytics> => {
    const params: Record<string, string> = {};
    if (opts.segmentBy) params.segmentBy = opts.segmentBy;
    if (opts.includeSamples) params.includeSamples = '1';
    const { data } = await apiClient.get<SurveyAnalytics>(
      `/admin/surveys/${encodeURIComponent(surveyId)}/analytics`,
      { params: Object.keys(params).length ? params : undefined },
    );
    return data;
  },

  updatePostEventAttendance: async (registrationId: string, status: 'VERIFIED' | 'DENIED') => {
    const { data } = await apiClient.patch(
      `/admin/registrations/${encodeURIComponent(registrationId)}/post-event-attendance`,
      { status },
    );
    return data;
  },

  listRecentlyApprovedWebinarRegistrations: async () => {
    const { data } = await apiClient.get('/admin/webinar-registrations/recently-approved');
    return data as Array<{
      id: string;
      status: string;
      createdAt: string;
      reviewedAt: string | null;
      undoExpiresAt: string | null;
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
        duration?: number | null;
      };
    }>;
  },

  sendRegistrationInvites: async (payload: {
    programIds: string[];
    userIds?: string[];
    role?: 'HCP' | 'KOL';
  }) => {
    const { data } = await apiClient.post('/admin/registration-invites', payload);
    return data as {
      registerUrl: string;
      programs: { id: string; title: string }[];
      emailed: number;
      skipped: { userId: string; email: string; reason: string }[];
    };
  },

  undoRegistrationApproval: async (registrationId: string) => {
    const { data } = await apiClient.post(
      `/admin/registrations/${encodeURIComponent(registrationId)}/undo-approval`,
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
      intakeSubmissionId: string | null;
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

  refreshZoomPanelists: async (programId: string): Promise<{ refreshed: number; panelists: { name: string; email: string; joinUrl: string }[] }> => {
    const { data } = await apiClient.post(`/admin/programs/${encodeURIComponent(programId)}/refresh-zoom-panelists`);
    return data as { refreshed: number; panelists: { name: string; email: string; joinUrl: string }[] };
  },

  // ─── Users ───────────────────────────────────────────────────────────────

  getUsers: async (params?: { q?: string; role?: string; limit?: number }): Promise<AdminUser[]> => {
    const { data } = await apiClient.get<AdminUser[]>('/admin/users', { params });
    return data;
  },

  getUserPaidPayments: async (userId: string): Promise<AdminUserPaidPayment[]> => {
    const { data } = await apiClient.get<AdminUserPaidPayment[]>(
      `/admin/users/${encodeURIComponent(userId)}/payments`,
    );
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

  getFailedPayments: async () => {
    try {
      const { data } = await apiClient.get<FailedPayment[]>('/payments/failed');
      return data;
    } catch (err) {
      if (import.meta.env.VITE_DISABLE_AUTH === 'true' && (err as { code?: string })?.code === 'ERR_NETWORK') {
        return [];
      }
      throw err;
    }
  },

  getPaidPayments: async (params?: { limit?: number }) => {
    try {
      const { data } = await apiClient.get<PaidPayment[]>('/payments/paid', {
        params: params?.limit != null ? { limit: params.limit } : undefined,
      });
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

  retryPayment: async (paymentId: string) => {
    const { data } = await apiClient.post(`/payments/${paymentId}/retry`);
    return data;
  },

  deletePayment: async (paymentId: string) => {
    const { data } = await apiClient.delete(`/payments/${paymentId}`);
    return data;
  },

  createManualPayment: async (body: {
    userId: string;
    programId?: string;
    amount: number;
    description?: string;
    type?: 'HONORARIUM' | 'CME_COMPLETION' | 'SURVEY_BONUS' | 'REFERRAL';
  }) => {
    const { data } = await apiClient.post('/payments/manual', body);
    return data as PendingPayment;
  },

  getWebhookImports: async (): Promise<WebhookImportedProgram[]> => {
    const { data } = await apiClient.get<WebhookImportedProgram[]>('/admin/programs/webhook-imports');
    return data ?? [];
  },

  // ─── KOL Network ─────────────────────────────────────────────────────────

  getKolNetwork: async (params?: { q?: string }): Promise<AdminKolNetworkList> => {
    const { data } = await apiClient.get<AdminKolNetworkList>('/admin/kol-network', { params });
    return data ?? { items: [], total: 0, institutions: [] };
  },

  updateKolVisibility: async (
    slug: string,
    patch: { visibleOnPublic?: boolean; visibleOnApp?: boolean },
  ): Promise<{ slug: string; visibility: KolVisibilityFlags }> => {
    const { data } = await apiClient.patch<{ slug: string; visibility: KolVisibilityFlags }>(
      `/admin/kol-network/${encodeURIComponent(slug)}/visibility`,
      patch,
    );
    return data;
  },
};

export type KolVisibilityFlags = {
  visibleOnPublic: boolean;
  visibleOnApp: boolean;
};

export type AdminKolNetworkItem = {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  specialty: string | null;
  institution: string | null;
  region_label: string | null;
  shoot_count: number;
  is_new: boolean;
  intel?: {
    publications_approx?: number | null;
    open_payments?: { total: number; records: number; years: string } | null;
    specialty?: string | null;
  } | null;
  visibility: KolVisibilityFlags;
};

export type AdminKolNetworkList = {
  items: AdminKolNetworkItem[];
  total: number;
  institutions: string[];
};
