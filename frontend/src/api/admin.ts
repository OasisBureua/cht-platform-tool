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

/** Zoom webinar options sent to POST/PATCH /admin/webinars (maps to Zoom API settings). */
export type ZoomWebinarSettings = {
  questionAndAnswer: boolean;
  backstage: boolean;
  hdVideoScreenShare: boolean;
  hdVideo1080p: boolean;
  emailInAttendeeReport: boolean;
  autoRecordCloud: boolean;
};

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
  /** WEBINAR only. Zoom Q&A / Backstage / HD / recording toggles. */
  zoomSettings?: ZoomWebinarSettings;
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
  /** WEBINAR only. Written to the linked Zoom webinar. */
  zoomSettings?: ZoomWebinarSettings;
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
  questions: Record<string, unknown>[] | Record<string, unknown>;
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK' | 'INTAKE';
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
  city?: string | null;
  /** Organization / institution from profile */
  institution?: string | null;
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
  deliveryMethod?: 'ACH' | 'CHECK' | null;
  checkStatus?: string | null;
  checkMailedAt?: string | null;
  checkDeliveredAt?: string | null;
  checkTrackingInfo?: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    billVendorId: string | null;
    w9Submitted?: boolean;
    preferredPaymentMethod?: 'ACH' | 'CHECK' | null;
    bankAccountLast4?: string | null;
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
  paymentsPaidCents?: number;
  pendingPaymentsCount?: number;
  pendingRegistrationsCount?: number;
  publishedLiveProgramsCount?: number;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string;
  actorEmail: string | null;
  actorRole?: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
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
  /** True when a Zoom/Meeting SDK JOINED event matched this learner. */
  zoomJoined?: boolean;
  /** Email Zoom reported on join (may differ from platform email). */
  zoomParticipantEmail?: string | null;
  user: { id: string; email: string; firstName: string; lastName: string };
  slot: { id: string; startsAt: string; endsAt: string; label: string | null } | null;
}

export type ProgramZoomRecordingRow = {
  id: string;
  programId: string;
  zoomMeetingId: string;
  zoomRecordingFileId: string;
  fileType: string;
  recordingType?: string | null;
  fileExtension?: string | null;
  fileSizeBytes?: number | null;
  topic?: string | null;
  recordingStart?: string | null;
  recordingEnd?: string | null;
  pulledAt: string | null;
  pulledByUserId?: string | null;
  pullStatus?: string;
  storedInS3?: boolean;
};

export type ProgramZoomRecordingsList = {
  storageConfigured: boolean;
  zoomConfigured: boolean;
  recordings: ProgramZoomRecordingRow[];
};

export type ZoomRecordingCatalogSession = {
  id: string;
  zoomMeetingId: string;
  topic: string | null;
  hostEmail: string | null;
  startTime: string | null;
  sessionType: string;
  programId: string | null;
  programTitle: string | null;
  chmProgramId: string | null;
  linked: boolean;
  fileCount: number;
  filesInS3Count: number;
  attendeesImported?: boolean;
  attendeeImportCount?: number;
  attendanceLastImportedAt?: string | null;
  attendeeCount?: number;
  attendeeReportStoredInS3?: boolean;
  attendeeReportExportedAt?: string | null;
  attendeeReportParticipantCount?: number | null;
  lastSyncedAt: string;
};

export type ZoomRecordingCatalogList = {
  storageConfigured: boolean;
  zoomConfigured: boolean;
  page: number;
  pageSize: number;
  total: number;
  sessions: ZoomRecordingCatalogSession[];
};

export type ZoomRecordingCatalogDetail = {
  storageConfigured: boolean;
  zoomConfigured: boolean;
  session: ZoomRecordingCatalogSession;
  files: ProgramZoomRecordingRow[];
};

export type ZoomSyncJobProgress = {
  monthsTotal: number;
  monthsDone: number;
  usersTotal?: number;
  usersDone?: number;
  windowsTotal?: number;
  windowsDone?: number;
  sessionsUpserted: number;
  fileStubsUpserted: number;
  errors: string[];
};

export type ZoomSyncJob = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  monthsBack: number;
  sessionTypeFilter: string | null;
  fromDate: string;
  toDate: string;
  startedAt: string | null;
  finishedAt: string | null;
  startedByUserId: string | null;
  progress: ZoomSyncJobProgress | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZoomAttendanceImportJobProgress = {
  sessionsTotal: number;
  sessionsDone: number;
  participantsUpserted: number;
  registrationsAutoVerified: number;
  reportsExported: number;
  reportExportErrors: string[];
  errors: string[];
};

export type ZoomAttendanceImportJob = {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  monthsBack: number;
  sessionTypeFilter: string | null;
  runAutoVerify: boolean;
  fromDate: string;
  toDate: string;
  startedAt: string | null;
  finishedAt: string | null;
  startedByUserId: string | null;
  progress: ZoomAttendanceImportJobProgress | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ZoomAttendanceParticipant = {
  id: string;
  zoomParticipantId: string;
  participantName: string | null;
  participantEmail: string | null;
  joinTime: string;
  leaveTime: string | null;
  durationSeconds: number | null;
  isHost: boolean;
  source: string;
  matchedRegistration: boolean;
};

export type ZoomSessionAttendanceList = {
  sessionId: string;
  linked: boolean;
  page: number;
  pageSize: number;
  total: number;
  search: string | null;
  participants: ZoomAttendanceParticipant[];
};

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

export type CampaignMetricTotals = {
  sessions: number;
  influencedContacts: number;
  newContactsFirstTouch: number;
  newContactsLastTouch: number;
  emailSent: number;
  emailOpens: number;
  emailClicks: number;
  landingPageViews: number;
  formSubmissions: number;
  socialClicks: number;
  marketingEventRegistrations: number;
};

export type HubSpotSocialPost = {
  id: string;
  name: string;
  network: string | null;
  facebookClicks: number;
  linkedinClicks: number;
  twitterClicks: number;
  totalClicks: number;
};

export type CampaignVideoStat = {
  id: string;
  title: string;
  platform: string | null;
  postedAt: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  durationSeconds: number | null;
  url: string | null;
};

export type CampaignTranscriptStat = {
  id: string;
  title: string;
  shootId: string | null;
  shootName: string | null;
  available: boolean;
  wordCount: number | null;
  doctors: string[];
};

export type CampaignSurveyQuestionSummary = {
  prompt: string;
  kind: string;
  summary: string;
};

export type CampaignSurveySummary = {
  surveyId: string;
  title: string;
  type: string;
  jotformFormId: string | null;
  jotformFormUrl: string | null;
  programId: string | null;
  programTitle: string | null;
  totalResponses: number;
  uniqueRespondents: number;
  completionRate: number | null;
  lastResponseAt: string | null;
  jotformSubmissionCount: number | null;
  questions: CampaignSurveyQuestionSummary[];
};

export type CampaignDashboardRow = {
  hubspotCampaignId: string | null;
  name: string;
  status: string | null;
  contentHubCampaignId: number | null;
  contentHubCampaignName: string | null;
  contentHubClientSponsor: string | null;
  contentHubCampaignStatus: string | null;
  contentHubPlatforms: string[];
  contentHubPlatformSnapshots: Array<{
    platform: string;
    status: string;
    syncedAt: string | null;
    rowCount: number | null;
  }>;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  hubspotSyncedAt: string | null;
  dataSource: 'live' | 'cached' | 'content_hub' | 'list_only';
  metrics: CampaignMetricTotals;
  assetCounts: Record<string, number>;
  socialPosts: HubSpotSocialPost[];
  videos: CampaignVideoStat[];
  transcripts: CampaignTranscriptStat[];
  survey: CampaignSurveySummary | null;
  warnings: string[];
  errors: string[];
};

export type CampaignsDashboardResponse = {
  syncedAt: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  hubspot: {
    connected: boolean;
    accountName: string | null;
    portalId: string | null;
    marketingScopesGranted: boolean;
    missingScopes: string[];
    scopeSetupUrl: string;
    error?: string;
  };
  contentHub: {
    configured: boolean;
    reachable: boolean;
    error?: string;
    totalCampaigns: number;
    linkedCampaigns: number;
    campaignsWithCachedHubspotData: number;
    platformsAvailable: number;
  };
  summary: CampaignMetricTotals & {
    totalHubSpotCampaigns: number;
    campaignsWithMetricData: number;
    campaignsFromCache: number;
    contentHubCampaignsShown: number;
  };
  campaigns: CampaignDashboardRow[];
  warnings: string[];
  errors: string[];
};

export type FunnelStageKey =
  | 'aware'
  | 'engaged'
  | 'captured'
  | 'registered'
  | 'attended'
  | 'converted';

export type FunnelStageSummary = {
  key: FunnelStageKey;
  label: string;
  count: number;
  dropOffFromPreviousPct: number | null;
  source: string;
  peopleAvailable: boolean;
};

export type CampaignsFunnelResponse = {
  syncedAt: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  stages: FunnelStageSummary[];
  clientRollup: Array<{
    clientSponsor: string | null;
    linked: boolean;
    campaignCount: number;
    countsByStage: Record<FunnelStageKey, number>;
  }>;
  filters: {
    campaigns: Array<{ id: string; name: string }>;
    clients: string[];
    programs: Array<{ id: string; title: string }>;
  };
  warnings: string[];
  hubspot: {
    connected: boolean;
    marketingScopesGranted: boolean;
    missingScopes: string[];
  };
  contentHub: {
    configured: boolean;
    reachable: boolean;
  };
};

export type CampaignsFunnelQuery = {
  startDate?: string;
  endDate?: string;
  campaignId?: string;
  clientSponsor?: string;
  programId?: string;
};

export type FunnelPersonRow = {
  userId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  npiNumber: string | null;
  programId: string | null;
  programTitle: string | null;
  campaignId: string | null;
  campaignName: string | null;
  clientSponsor: string | null;
  stageEnteredAt: string | null;
};

export type CampaignsFunnelPeopleResponse = {
  stage: FunnelStageKey;
  peopleAvailable: boolean;
  items: FunnelPersonRow[];
  total: number;
  limit: number;
  offset: number;
  warnings: string[];
};

export type CampaignsFunnelPeopleQuery = CampaignsFunnelQuery & {
  stage: FunnelStageKey;
  limit?: number;
  offset?: number;
};

export type CampaignsFunnelHcpResponse = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  npiNumber: string | null;
  match: {
    matched: boolean;
    method: 'email' | 'npi' | null;
  };
  lastCampaign: {
    id: string | null;
    name: string | null;
    clientSponsor: string | null;
  } | null;
  lastChtActivity: Array<{
    type: 'register' | 'attend' | 'survey';
    at: string | null;
    programId: string | null;
    programTitle: string | null;
  }>;
  warnings: string[];
};

const EMPTY_CAMPAIGN_METRICS: CampaignMetricTotals = {
  sessions: 0,
  influencedContacts: 0,
  newContactsFirstTouch: 0,
  newContactsLastTouch: 0,
  emailSent: 0,
  emailOpens: 0,
  emailClicks: 0,
  landingPageViews: 0,
  formSubmissions: 0,
  socialClicks: 0,
  marketingEventRegistrations: 0,
};

const DEFAULT_HUBSPOT_MARKETING_SCOPES = [
  'marketing.campaigns.read',
  'marketing-email',
] as const;

const HUBSPOT_SCOPES_DOC_URL =
  'https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/scopes';

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCampaignVideos(raw: unknown): CampaignVideoStat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : null;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      if (!id || !title) return null;
      return {
        id,
        title,
        platform: typeof row.platform === 'string' ? row.platform : null,
        postedAt: typeof row.postedAt === 'string' ? row.postedAt : null,
        views: toNullableNumber(row.views),
        likes: toNullableNumber(row.likes),
        comments: toNullableNumber(row.comments),
        durationSeconds: toNullableNumber(row.durationSeconds),
        url: typeof row.url === 'string' ? row.url : null,
      } satisfies CampaignVideoStat;
    })
    .filter((item): item is CampaignVideoStat => item != null);
}

function normalizeCampaignTranscripts(raw: unknown): CampaignTranscriptStat[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = typeof row.id === 'string' ? row.id : null;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      if (!id || !title) return null;
      return {
        id,
        title,
        shootId: typeof row.shootId === 'string' ? row.shootId : null,
        shootName: typeof row.shootName === 'string' ? row.shootName : null,
        available: row.available === true,
        wordCount: toNullableNumber(row.wordCount),
        doctors: Array.isArray(row.doctors)
          ? row.doctors.filter((d): d is string => typeof d === 'string')
          : [],
      } satisfies CampaignTranscriptStat;
    })
    .filter((item): item is CampaignTranscriptStat => item != null);
}

function normalizeCampaignMetricTotals(
  raw: Partial<CampaignMetricTotals> | null | undefined,
): CampaignMetricTotals {
  return {
    sessions: raw?.sessions ?? 0,
    influencedContacts: raw?.influencedContacts ?? 0,
    newContactsFirstTouch: raw?.newContactsFirstTouch ?? 0,
    newContactsLastTouch: raw?.newContactsLastTouch ?? 0,
    emailSent: raw?.emailSent ?? 0,
    emailOpens: raw?.emailOpens ?? 0,
    emailClicks: raw?.emailClicks ?? 0,
    landingPageViews: raw?.landingPageViews ?? 0,
    formSubmissions: raw?.formSubmissions ?? 0,
    socialClicks: raw?.socialClicks ?? 0,
    marketingEventRegistrations: raw?.marketingEventRegistrations ?? 0,
  };
}

function normalizeCampaignDashboardRow(
  raw: Partial<CampaignDashboardRow> & Record<string, unknown>,
): CampaignDashboardRow {
  return {
    hubspotCampaignId:
      typeof raw.hubspotCampaignId === 'string' ? raw.hubspotCampaignId : null,
    name: typeof raw.name === 'string' ? raw.name : 'Campaign',
    status: typeof raw.status === 'string' ? raw.status : null,
    contentHubCampaignId:
      typeof raw.contentHubCampaignId === 'number' ? raw.contentHubCampaignId : null,
    contentHubCampaignName:
      typeof raw.contentHubCampaignName === 'string'
        ? raw.contentHubCampaignName
        : null,
    contentHubClientSponsor:
      typeof raw.contentHubClientSponsor === 'string'
        ? raw.contentHubClientSponsor
        : null,
    contentHubCampaignStatus:
      typeof raw.contentHubCampaignStatus === 'string'
        ? raw.contentHubCampaignStatus
        : null,
    contentHubPlatforms: Array.isArray(raw.contentHubPlatforms)
      ? raw.contentHubPlatforms.filter((p): p is string => typeof p === 'string')
      : [],
    contentHubPlatformSnapshots: Array.isArray(raw.contentHubPlatformSnapshots)
      ? raw.contentHubPlatformSnapshots
      : [],
    reportingPeriodStart:
      typeof raw.reportingPeriodStart === 'string' ? raw.reportingPeriodStart : null,
    reportingPeriodEnd:
      typeof raw.reportingPeriodEnd === 'string' ? raw.reportingPeriodEnd : null,
    hubspotSyncedAt:
      typeof raw.hubspotSyncedAt === 'string' ? raw.hubspotSyncedAt : null,
    dataSource:
      raw.dataSource === 'live' ||
      raw.dataSource === 'cached' ||
      raw.dataSource === 'content_hub'
        ? raw.dataSource
        : 'list_only',
    metrics: normalizeCampaignMetricTotals(raw.metrics),
    assetCounts:
      raw.assetCounts && typeof raw.assetCounts === 'object'
        ? (raw.assetCounts as Record<string, number>)
        : {},
    socialPosts: Array.isArray(raw.socialPosts)
      ? (raw.socialPosts as HubSpotSocialPost[])
      : [],
    videos: normalizeCampaignVideos(raw.videos),
    transcripts: normalizeCampaignTranscripts(raw.transcripts),
    survey:
      raw.survey && typeof raw.survey === 'object'
        ? (raw.survey as CampaignSurveySummary)
        : null,
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    errors: Array.isArray(raw.errors) ? raw.errors : [],
  };
}

function normalizeCampaignsDashboardResponse(
  data: Partial<CampaignsDashboardResponse> & Record<string, unknown>,
): CampaignsDashboardResponse {
  const summary = (data.summary ?? {}) as Partial<
    CampaignsDashboardResponse['summary']
  > & { campaignsWithMetrics?: number };
  const hubspot = (data.hubspot ?? {}) as Partial<
    CampaignsDashboardResponse['hubspot']
  >;
  const contentHub = (data.contentHub ?? {}) as Partial<
    CampaignsDashboardResponse['contentHub']
  >;

  return {
    syncedAt:
      typeof data.syncedAt === 'string' ? data.syncedAt : new Date().toISOString(),
    reportingPeriodStart:
      typeof data.reportingPeriodStart === 'string' ? data.reportingPeriodStart : '',
    reportingPeriodEnd:
      typeof data.reportingPeriodEnd === 'string' ? data.reportingPeriodEnd : '',
    hubspot: {
      connected: hubspot.connected ?? false,
      accountName: hubspot.accountName ?? null,
      portalId: hubspot.portalId ?? null,
      marketingScopesGranted: hubspot.marketingScopesGranted ?? false,
      missingScopes:
        Array.isArray(hubspot.missingScopes) && hubspot.missingScopes.length > 0
          ? hubspot.missingScopes
          : [...DEFAULT_HUBSPOT_MARKETING_SCOPES],
      scopeSetupUrl: hubspot.scopeSetupUrl ?? HUBSPOT_SCOPES_DOC_URL,
      ...(hubspot.error ? { error: hubspot.error } : {}),
    },
    contentHub: {
      configured: contentHub.configured ?? false,
      reachable: contentHub.reachable ?? false,
      ...(contentHub.error ? { error: contentHub.error } : {}),
      totalCampaigns: contentHub.totalCampaigns ?? contentHub.linkedCampaigns ?? 0,
      linkedCampaigns: contentHub.linkedCampaigns ?? 0,
      campaignsWithCachedHubspotData: contentHub.campaignsWithCachedHubspotData ?? 0,
      platformsAvailable: contentHub.platformsAvailable ?? 0,
    },
    summary: {
      ...normalizeCampaignMetricTotals(summary),
      totalHubSpotCampaigns: summary.totalHubSpotCampaigns ?? 0,
      campaignsWithMetricData:
        summary.campaignsWithMetricData ?? summary.campaignsWithMetrics ?? 0,
      campaignsFromCache: summary.campaignsFromCache ?? 0,
      contentHubCampaignsShown: summary.contentHubCampaignsShown ?? 0,
    },
    campaigns: Array.isArray(data.campaigns)
      ? data.campaigns.map((row) =>
          normalizeCampaignDashboardRow(
            row as Partial<CampaignDashboardRow> & Record<string, unknown>,
          ),
        )
      : [],
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
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

  getCampaignsDashboard: async (params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<CampaignsDashboardResponse> => {
    const { data } = await apiClient.get<CampaignsDashboardResponse>(
      '/admin/campaigns/dashboard',
      { params },
    );
    return normalizeCampaignsDashboardResponse(data);
  },

  getCampaignsFunnel: async (
    params?: CampaignsFunnelQuery,
  ): Promise<CampaignsFunnelResponse> => {
    const { data } = await apiClient.get<CampaignsFunnelResponse>(
      '/admin/campaigns/funnel',
      { params },
    );
    return data;
  },

  getCampaignsFunnelPeople: async (
    params: CampaignsFunnelPeopleQuery,
  ): Promise<CampaignsFunnelPeopleResponse> => {
    const { data } = await apiClient.get<CampaignsFunnelPeopleResponse>(
      '/admin/campaigns/funnel/people',
      { params },
    );
    return data;
  },

  getCampaignsFunnelHcp: async (
    userId: string,
  ): Promise<CampaignsFunnelHcpResponse> => {
    const { data } = await apiClient.get<CampaignsFunnelHcpResponse>(
      `/admin/campaigns/funnel/hcp/${encodeURIComponent(userId)}`,
    );
    return data;
  },

  listAuditLogs: async (params?: {
    limit?: number;
    resource?: string;
    actorId?: string;
    actorRole?: string;
  }): Promise<{ items: AdminAuditLogEntry[]; total: number; limit: number }> => {
    const { data } = await apiClient.get<{
      items: AdminAuditLogEntry[];
      total: number;
      limit: number;
    }>('/admin/audit-logs', { params });
    return data;
  },

  exportPaymentsCsv: async (params?: {
    status?: 'PENDING' | 'FAILED' | 'PAID' | 'ALL';
    from?: string;
    to?: string;
  }): Promise<Blob> => {
    const { data } = await apiClient.get<Blob>('/payments/export.csv', {
      params,
      responseType: 'blob',
    });
    return data;
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

  updateSurvey: async (
    id: string,
    payload: {
      title?: string;
      description?: string;
      questions?: Record<string, unknown>;
      required?: boolean;
      jotformFormId?: string;
    },
  ) => {
    const { data } = await apiClient.patch(`/admin/surveys/${id}`, payload);
    return data;
  },

  ensureNativeSurveysForProgram: async (programId: string) => {
    const { data } = await apiClient.post<{
      intakeSurveyId: string;
      feedbackSurveyId: string;
    }>(`/admin/programs/${encodeURIComponent(programId)}/native-surveys`);
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

  getWebinarZoomSettings: async (
    id: string,
  ): Promise<{
    settings: ZoomWebinarSettings;
    source: 'zoom' | 'defaults';
    warning?: string;
  }> => {
    const { data } = await apiClient.get<{
      settings: ZoomWebinarSettings;
      source: 'zoom' | 'defaults';
      warning?: string;
    }>(`/admin/webinars/${encodeURIComponent(id)}/zoom-settings`);
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
            all?: Array<{
              id: string;
              title: string;
              type: string;
              createdAt: string;
              jotformFormId?: string | null;
              isCustomized?: boolean;
            }>;
          };
        }
      | ProgramRegistrationAdminRow[];
    if (Array.isArray(payload)) {
      return {
        registrations: payload,
        surveys: { intake: null, feedback: null, all: [] },
      };
    }
    return {
      registrations: payload.registrations ?? [],
      surveys: {
        intake: payload.surveys?.intake ?? null,
        feedback: payload.surveys?.feedback ?? null,
        all: payload.surveys?.all ?? [],
      },
    };
  },

  listProgramZoomRecordings: async (programId: string) => {
    const { data } = await apiClient.get(
      `/admin/programs/${encodeURIComponent(programId)}/recordings`,
    );
    return data as ProgramZoomRecordingsList;
  },

  pullProgramZoomRecordings: async (
    programId: string,
    body?: { zoomMeetingId?: string },
  ) => {
    const { data } = await apiClient.post(
      `/admin/programs/${encodeURIComponent(programId)}/recordings/pull`,
      body ?? {},
    );
    return data as ProgramZoomRecordingsList & {
      pulledCount: number;
      zoomMeetingId: string;
      topic?: string;
      errors?: string[];
    };
  },

  getProgramZoomRecordingDownloadUrl: async (
    programId: string,
    recordingId: string,
    disposition: 'inline' | 'attachment' = 'attachment',
  ) => {
    const { data } = await apiClient.get(
      `/admin/programs/${encodeURIComponent(programId)}/recordings/${encodeURIComponent(recordingId)}/download-url`,
      { params: { disposition } },
    );
    return data as {
      url: string;
      expiresInSeconds: number;
      recording: ProgramZoomRecordingRow;
    };
  },

  listZoomRecordingSessions: async (params?: {
    page?: number;
    pageSize?: number;
    linked?: boolean;
    q?: string;
  }) => {
    const { data } = await apiClient.get('/admin/zoom-recordings/sessions', {
      params: {
        page: params?.page,
        pageSize: params?.pageSize,
        linked:
          params?.linked === true
            ? 'true'
            : params?.linked === false
              ? 'false'
              : undefined,
        q: params?.q?.trim() || undefined,
      },
    });
    return data as ZoomRecordingCatalogList;
  },

  getZoomRecordingSession: async (sessionId: string) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}`,
    );
    return data as ZoomRecordingCatalogDetail;
  },

  pullZoomRecordingSession: async (
    sessionId: string,
    body?: { fileTypes?: string[] },
  ) => {
    const { data } = await apiClient.post(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/pull`,
      body ?? {},
    );
    return data as ZoomRecordingCatalogDetail & {
      pulledCount: number;
      errors?: string[];
    };
  },

  getZoomRecordingCatalogDownloadUrl: async (
    sessionId: string,
    fileId: string,
    disposition: 'inline' | 'attachment' = 'attachment',
  ) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(fileId)}/download-url`,
      { params: { disposition } },
    );
    return data as {
      url: string;
      expiresInSeconds: number;
      recording: ProgramZoomRecordingRow;
    };
  },

  linkZoomRecordingSession: async (sessionId: string, programId: string) => {
    const { data } = await apiClient.post(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/link`,
      { programId },
    );
    return data as ZoomRecordingCatalogDetail;
  },

  startZoomRecordingsSync: async (body?: { monthsBack?: number }) => {
    const { data } = await apiClient.post('/admin/zoom-recordings/sync', body ?? {});
    return data as ZoomSyncJob;
  },

  getLatestZoomSyncJob: async () => {
    const { data } = await apiClient.get('/admin/zoom-recordings/sync/latest');
    return (data as ZoomSyncJob | null) ?? null;
  },

  getZoomSyncJob: async (jobId: string) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/sync/${encodeURIComponent(jobId)}`,
    );
    return data as ZoomSyncJob;
  },

  startZoomAttendanceImport: async (body?: {
    monthsBack?: number;
    runAutoVerify?: boolean;
  }) => {
    const { data } = await apiClient.post(
      '/admin/zoom-recordings/attendance/import',
      body ?? {},
    );
    return data as ZoomAttendanceImportJob;
  },

  getLatestZoomAttendanceImportJob: async () => {
    const { data } = await apiClient.get('/admin/zoom-recordings/attendance/import/latest');
    return (data as ZoomAttendanceImportJob | null) ?? null;
  },

  getZoomAttendanceImportJob: async (jobId: string) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/attendance/import/${encodeURIComponent(jobId)}`,
    );
    return data as ZoomAttendanceImportJob;
  },

  listZoomSessionAttendance: async (
    sessionId: string,
    params?: { page?: number; pageSize?: number; search?: string },
  ) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/attendance`,
      {
        params: {
          page: params?.page,
          pageSize: params?.pageSize,
          search: params?.search || undefined,
        },
      },
    );
    return data as ZoomSessionAttendanceList;
  },

  getZoomSessionAttendanceReportDownloadUrl: async (sessionId: string) => {
    const { data } = await apiClient.get(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/attendance/report/download-url`,
    );
    return data as {
      url: string;
      expiresInSeconds: number;
      filename: string;
      participantCount: number | null;
      exportedAt: string | null;
      zoomMeetingId: string;
    };
  },

  importZoomSessionAttendance: async (
    sessionId: string,
    body?: { runAutoVerify?: boolean },
  ) => {
    const { data } = await apiClient.post(
      `/admin/zoom-recordings/sessions/${encodeURIComponent(sessionId)}/attendance/import`,
      body ?? {},
    );
    return data as ZoomRecordingCatalogDetail & {
      participantsUpserted: number;
      registrationsAutoVerified: number;
      reportExported?: boolean;
      reportParticipantCount?: number;
      reportExportError?: string | null;
      errors?: string[];
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
    emails?: string[];
    role?: 'HCP' | 'KOL';
    cities?: string[];
    states?: string[];
    institutions?: string[];
  }) => {
    const { data } = await apiClient.post('/admin/registration-invites', payload);
    return data as {
      registerUrl: string;
      programs: { id: string; title: string }[];
      emailed: number;
      skipped: { userId: string; email: string; reason: string }[];
    };
  },

  sendProgramOperationalEmail: async (
    programId: string,
    payload: { to: string[]; subject: string; body: string },
  ) => {
    const { data } = await apiClient.post(
      `/admin/programs/${encodeURIComponent(programId)}/operational-email`,
      payload,
    );
    return data as {
      programId: string;
      sent: number;
      failed: { email: string; error: string }[];
      extras: string[];
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
      /** Max(createdAt, updatedAt, intake submitted): use for “last request” after resubmits */
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

  getUsers: async (params?: {
    q?: string;
    role?: string;
    status?: string;
    cities?: string[];
    states?: string[];
    institutions?: string[];
    limit?: number;
  }): Promise<AdminUser[]> => {
    const { cities, states, institutions, ...rest } = params ?? {};
    const { data } = await apiClient.get<AdminUser[]>('/admin/users', {
      params: {
        ...rest,
        cities: cities?.length ? cities.join(',') : undefined,
        states: states?.length ? states.join(',') : undefined,
        institutions: institutions?.length ? institutions.join(',') : undefined,
      },
    });
    return data;
  },

  getRegistrationInviteFilterOptions: async (role: 'HCP' | 'KOL') => {
    const { data } = await apiClient.get<{
      cities: string[];
      states: string[];
      institutions: string[];
    }>('/admin/users/registration-invite-filter-options', { params: { role } });
    return data;
  },

  getRegistrationInviteRecipients: async (params: {
    role: 'HCP' | 'KOL';
    cities?: string[];
    states?: string[];
    institutions?: string[];
    limit?: number;
  }) => {
    const { data } = await apiClient.get<{
      recipients: AdminUser[];
      total: number;
    }>('/admin/users/registration-invite-recipients', {
      params: {
        role: params.role,
        cities: params.cities?.length ? params.cities.join(',') : undefined,
        states: params.states?.length ? params.states.join(',') : undefined,
        institutions: params.institutions?.length ? params.institutions.join(',') : undefined,
        limit: params.limit ?? 200,
      },
    });
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

  getManualPaymentEligibility: async (params: {
    userId: string;
    programId: string;
  }) => {
    const { data } = await apiClient.get<{
      userId: string;
      programId: string;
      programTitle: string;
      registrationFound: boolean;
      attendanceStatus: string | null;
      attendanceOk: boolean;
      surveyRequired: boolean;
      surveyAcknowledged: boolean;
      hasBillVendor: boolean;
      w9Submitted: boolean;
      programEligibilityOk: boolean;
      payNowReady: boolean;
      warnings: string[];
    }>('/payments/manual-eligibility', { params });
    return data;
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
