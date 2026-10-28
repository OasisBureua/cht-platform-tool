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
  /** Dollar amount may be omitted for learners; use hasHonorarium. */
  honorariumAmount?: number;
  hasHonorarium?: boolean;
  videos: Video[];
  zoomSessionType?: 'WEBINAR' | 'MEETING';
  zoomJoinUrl?: string;
  /** True when zoomJoinUrl is available (approved learner + within live join window). */
  canJoinSession?: boolean;
  /** ISO time when Join session opens (typically 15 min before start). */
  joinSessionOpensAt?: string;
  /** Why join is unavailable when canJoinSession is false. */
  joinSessionReason?: string;
  /** Returned from GET /programs/:id only when the viewer is an authenticated admin (Zoom host start URL). */
  zoomStartUrl?: string;
  startDate?: string;
  duration?: number;
  /** ISO timestamp from Zoom session-ended webhooks (preferred for showing post-event survey). */
  zoomSessionEndedAt?: string;
  jotformSurveyUrl?: string;
  jotformIntakeFormUrl?: string;
  hasPostEventSurvey?: boolean;
  hasIntakeSurvey?: boolean;
  feedbackSurveyId?: string;
  intakeSurveyId?: string;
  feedbackUsesJotform?: boolean;
  intakeUsesJotform?: boolean;
  jotformPreEventUrl?: string;
  registrationRequiresApproval?: boolean;
  hostDisplayName?: string;
  hostBio?: string;
  speakers?: string[];
  /** Session-specific compliance / sponsor disclaimer for learners */
  sessionDisclaimer?: string;
  /** HTTPS URL for banner image on session pages */
  sessionHeroImageUrl?: string;
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
  status: 'SURVEY_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITLISTED';
  officeHoursSlotId?: string;
  /** Present when intake Jotform redirect included a submission id */
  intakeSubmissionId?: string;
  /** When intake was recorded (submit or webhook) */
  intakeJotformSubmittedAt?: string;
  createdAt: string;
  reviewedAt?: string;
  postEventAttendanceStatus?: PostEventAttendanceStatus;
  postEventSurveyAcknowledgedAt?: string;
  postEventSurveySubmitted?: boolean;
  postEventSurveyResponseId?: string | null;
  /** True when intake answers exist (native SurveyResponse or legacy Jotform id). */
  intakeSurveySubmitted?: boolean;
  hasPostEventSurvey?: boolean;
  hasIntakeSurvey?: boolean;
  feedbackSurveyId?: string;
  intakeSurveyId?: string;
  honorariumRequestedAt?: string;
  /** When the learner confirmed Stripe payout details for this program. */
  payoutDetailsConfirmedAt?: string | null;
  /** REUSED = existing Connect details; NEWLY_ENTERED = set up/edited in this flow. */
  payoutDetailsEntryKind?: 'REUSED' | 'NEWLY_ENTERED' | null;
  honorariumPayment?: { id: string; status: string } | null;
}

export type HonorariumMissingRequirement =
  | 'STRIPE_ACCOUNT'
  | 'BANK_ACCOUNT'
  | 'TAX_DETAILS'
  | 'PAYOUTS_ENABLED';

export type HonorariumProgramPreview = {
  programTitle: string;
  hasHonorarium?: boolean;
  /** @deprecated Amount is admin-only; omitted for learners. */
  honorariumAmountCents?: number;
  payeeDisplayName: string;
  maskedBankLast4: string | null;
  addressSummary: string | null;
  /** True when the learner has a Stripe Connect payout account. */
  hasPayoutAccount: boolean;
  w9Submitted: boolean;
  stripePayoutsEnabled?: boolean;
  methodLabel?: string;
  /** ISO timestamp when Connect/tax details were first completed (masked display only). */
  detailsAddedAt?: string | null;
  missingRequirements?: HonorariumMissingRequirement[];
  /** True when account + tax + payouts are ready to confirm. */
  payoutReady?: boolean;
};

export type LiveWebinarActionItem = {
  id: string;
  kind: 'WEBINAR_INVITATION_SURVEY' | 'WEBINAR_POST_EVENT_SURVEY';
  title: string;
  body: string;
  programId: string;
  href: string;
};

/** One row of GET /programs/me/post-event-progress: a session with an unpaid honorarium (dashboard card). */
export type PostEventProgressItem = {
  programId: string;
  title: string;
  zoomSessionType: 'WEBINAR' | 'MEETING';
  startDate: string | null;
  hasSurvey: boolean;
  hasHonorarium: boolean;
  nativeSurvey: boolean;
  feedbackSurveyId: string | null;
  attendance: PostEventAttendanceStatus;
  surveyAcknowledged: boolean;
  surveySubmitted: boolean;
  surveyDraftSaved: boolean;
  paymentInfoConfirmed: boolean;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | null;
  payoutReady: boolean;
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

  /** Sessions with an unpaid honorarium and the facts for the post-event step map (SCRUM-288). */
  getMyPostEventProgress: async (): Promise<PostEventProgressItem[]> => {
    const { data } = await apiClient.get<PostEventProgressItem[]>('/programs/me/post-event-progress');
    return Array.isArray(data) ? data : [];
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
    body: { officeHoursSlotId?: string; intakeSubmissionId?: string },
  ): Promise<{ id: string; status: string; enrolled: boolean }> => {
    const { data } = await apiClient.post(`/programs/${encodeURIComponent(programId)}/registration`, body);
    return data;
  },

  submitBatchRegistrations: async (
    programIds: string[],
    intakeByProgramId?: Record<string, string>,
  ): Promise<{
    submitted: Array<{
      programId: string;
      title: string;
      status: string;
      enrolled: boolean;
    }>;
    skipped: Array<{ programId: string; title: string; reason: string }>;
    failed: Array<{ programId: string; title: string; message: string }>;
  }> => {
    const { data } = await apiClient.post('/programs/registrations/batch', {
      programIds,
      ...(intakeByProgramId && Object.keys(intakeByProgramId).length > 0
        ? { intakeByProgramId }
        : {}),
    });
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
    opts?: { entryKind?: 'REUSED' | 'NEWLY_ENTERED' },
  ): Promise<{
    paymentId: string | null;
    created: boolean;
    alreadyRequested?: true;
    entryKind?: 'REUSED' | 'NEWLY_ENTERED';
  }> => {
    const { data } = await apiClient.post<{
      paymentId: string | null;
      created: boolean;
      alreadyRequested?: true;
      entryKind?: 'REUSED' | 'NEWLY_ENTERED';
    }>(`/programs/${encodeURIComponent(programId)}/post-event/request-honorarium`, {
      ...(opts?.entryKind ? { entryKind: opts.entryKind } : {}),
    });
    return data;
  },

  getHonorariumPreview: async (programId: string): Promise<HonorariumProgramPreview> => {
    const { data } = await apiClient.get<HonorariumProgramPreview>(
      `/programs/${encodeURIComponent(programId)}/honorarium-preview`,
    );
    return data;
  },
};
