import apiClient from './client';
import { mockPrograms } from '../mocks/programs.mocks';
import { demoEnrollmentsStore } from '../mocks/enrollments.mocks';

const ENABLE_MOCK_FALLBACK = import.meta.env.DEV;

export interface Video {
  id: string;
  title: string;
  description?: string;
  platform: string;
  videoId: string;
  embedUrl: string;
  duration: number;
  order: number;
}

export interface Program {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  creditAmount: number;
  accreditationBody?: string;
  status: string;
  sponsorName: string;
  sponsorLogo?: string;
  honorariumAmount?: number;
  videos: Video[];
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  zoomJoinUrl?: string;
  /** Returned from GET /programs/:id only when the viewer is an authenticated admin (Zoom host start URL). */
  zoomStartUrl?: string;
  startDate?: string;
  duration?: number;
  /** ISO timestamp from Zoom session-ended webhooks (preferred for showing post-event survey). */
  zoomSessionEndedAt?: string;
  jotformSurveyUrl?: string;
  jotformIntakeFormUrl?: string;
  jotformPreEventUrl?: string;
  registrationRequiresApproval?: boolean;
  hostDisplayName?: string;
}

export interface OfficeHoursSlotOption {
  id: string;
  startsAt: string;
  endsAt: string;
  label?: string;
  maxAttendees: number;
  remaining: number;
}

export type PostEventAttendanceStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'DENIED';

export interface ProgramRegistrationState {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED';
  officeHoursSlotId?: string;
  /** Present when intake Jotform redirect included a submission id */
  intakeJotformSubmissionId?: string;
  /** When intake was recorded (submit or webhook) */
  intakeJotformSubmittedAt?: string;
  createdAt: string;
  reviewedAt?: string;
  postEventAttendanceStatus?: PostEventAttendanceStatus;
  postEventSurveyAcknowledgedAt?: string;
  postEventJotformSubmissionId?: string;
  honorariumRequestedAt?: string;
  honorariumPayment?: { id: string; status: string } | null;
}

export type HonorariumProgramPreview = {
  programTitle: string;
  honorariumAmountCents: number;
  payeeDisplayName: string;
  maskedBankLast4: string | null;
  addressSummary: string | null;
  hasBillVendor: boolean;
  w9Submitted: boolean;
};

export type LiveWebinarActionItem = {
  id: string;
  kind: 'WEBINAR_INVITATION_SURVEY' | 'WEBINAR_POST_EVENT_SURVEY';
  title: string;
  body: string;
  programId: string;
  href: string;
};

export type MyLiveSessionListStatus = {
  programId: string;
  enrolled: boolean;
  registrationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED' | null;
};

export interface Enrollment {
  id: string;
  userId: string;
  programId: string;
  overallProgress: number;
  completed: boolean;
  enrolledAt: string;
  completedAt?: string;
  program: {
    id: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    creditAmount: number;
    honorariumAmount?: number;
    videosCount: number;
  };
}

export const programsApi = {
  getLiveActionItems: async (): Promise<LiveWebinarActionItem[]> => {
    const { data } = await apiClient.get<LiveWebinarActionItem[]>('/programs/live-action-items');
    return data ?? [];
  },

  getMyLiveSessionStatus: async (): Promise<MyLiveSessionListStatus[]> => {
    const { data } = await apiClient.get<MyLiveSessionListStatus[]>('/programs/me/live-session-status');
    return data ?? [];
  },

  getAll: async (): Promise<Program[]> => {
    try {
      const { data } = await apiClient.get('/programs');
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) {
        console.warn('[Programs] API failed - using mock programs');
        return mockPrograms;
      }
      throw err;
    }
  },

  getById: async (id: string): Promise<Program> => {
    try {
      const { data } = await apiClient.get(`/programs/${id}`);
      // if backend returns null/undefined for unknown id, treat as not found
      if (!data) throw new Error('Program not found');
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) {
        const match = mockPrograms.find((p) => p.id === id);
        if (match) return match;
      }
      throw err;
    }
  },

  enroll: async (userId: string, programId: string) => {
  try {
    const { data } = await apiClient.post('/programs/enroll', { userId, programId });
    return data;
  } catch (err) {
    if (ENABLE_MOCK_FALLBACK) {
      console.warn('[Programs] enroll API failed - using demo enrollment');
      const program =
        mockPrograms.find((p) => p.id === programId) ??
        (await (async () => {
          // if mocks don't include it, fallback to getById (which may also mock)
          try {
            return await programsApi.getById(programId);
          } catch {
            return null;
          }
        })());

      if (!program) throw err;

      return demoEnrollmentsStore.add(userId, {
        id: program.id,
        title: program.title,
        description: program.description,
        thumbnailUrl: program.thumbnailUrl,
        creditAmount: program.creditAmount,
        honorariumAmount: program.honorariumAmount,
        videosCount: program.videos?.length ?? 0,
      });
    }
    throw err;
  }
},

  getEnrollments: async (userId: string): Promise<Enrollment[]> => {
  try {
    const { data } = await apiClient.get(`/programs/enrollments/${userId}`);
    return data;
  } catch (err) {
    if (ENABLE_MOCK_FALLBACK) {
      console.warn('[Programs] enrollments API failed - using demo enrollments');
      return demoEnrollmentsStore.getAll(userId);
    }
    throw err;
  }
},

  updateVideoProgress: async (
    userId: string,
    videoId: string,
    watchedSeconds: number,
    progress: number,
    completed: boolean
  ) => {
    const { data } = await apiClient.post('/programs/video-progress', {
      userId,
      videoId,
      watchedSeconds,
      progress,
      completed,
    });
    return data;
  },

  getSlots: async (programId: string): Promise<OfficeHoursSlotOption[]> => {
    const { data } = await apiClient.get<OfficeHoursSlotOption[]>(`/programs/${encodeURIComponent(programId)}/slots`);
    return data ?? [];
  },

  getMyRegistration: async (programId: string): Promise<ProgramRegistrationState | null> => {
    const { data } = await apiClient.get<ProgramRegistrationState | null>(
      `/programs/${encodeURIComponent(programId)}/registration`,
    );
    return data ?? null;
  },

  submitRegistration: async (
    programId: string,
    body: { officeHoursSlotId?: string; intakeJotformSubmissionId?: string },
  ): Promise<{ id: string; status: string; enrolled: boolean }> => {
    const { data } = await apiClient.post(`/programs/${encodeURIComponent(programId)}/registration`, body);
    return data;
  },

  getJotformResume: async (
    programId: string,
  ): Promise<{ sessionId: string; expiresAt: string } | null> => {
    const { data } = await apiClient.get(`/programs/${encodeURIComponent(programId)}/jotform-resume`);
    return data ?? null;
  },

  putJotformResume: async (programId: string, sessionId: string): Promise<void> => {
    await apiClient.put(`/programs/${encodeURIComponent(programId)}/jotform-resume`, { sessionId });
  },

  acknowledgePostEventSurvey: async (programId: string): Promise<void> => {
    await apiClient.post(`/programs/${encodeURIComponent(programId)}/post-event/acknowledge-survey`);
  },

  requestPostEventHonorarium: async (
    programId: string,
  ): Promise<{
    paymentId: string | null;
    created: boolean;
    alreadyRequested?: true;
  }> => {
    const { data } = await apiClient.post<{
      paymentId: string | null;
      created: boolean;
      alreadyRequested?: true;
    }>(`/programs/${encodeURIComponent(programId)}/post-event/request-honorarium`);
    return data;
  },

  getHonorariumPreview: async (programId: string): Promise<HonorariumProgramPreview> => {
    const { data } = await apiClient.get<HonorariumProgramPreview>(
      `/programs/${encodeURIComponent(programId)}/honorarium-preview`,
    );
    return data;
  },
};
