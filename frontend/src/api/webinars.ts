import apiClient from './client';

export interface WebinarItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startTime?: string;
  duration?: number;
  joinUrl?: string;
  source: 'zoom' | 'program';
  sessionKind?: 'WEBINAR' | 'MEETING';
  hostDisplayName?: string;
  hostBio?: string;
  speakers?: string[];
  /** @deprecated Intake is native-only. */
  jotformIntakeFormUrl?: string;
  intakeSurveyId?: string;
  hasIntakeSurvey?: boolean;
  registrationRequiresApproval?: boolean;
  /** Whole dollars from API (converted from DB cents on the server). */
  honorariumAmount?: number;
}

/** Response from POST .../meeting-sdk-auth for Zoom Meeting SDK embedded client. */
export type MeetingSdkAuth = {
  signature: string;
  sdkKey?: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail?: string;
  /** Zoom registrant token when required (`tk` on the join URL). */
  tk?: string;
  sessionKind?: 'WEBINAR' | 'MEETING';
};

export const webinarsApi = {
  list: async (): Promise<WebinarItem[]> => {
    const { data } = await apiClient.get<WebinarItem[]>('/webinars');
    return data || [];
  },

  getById: async (id: string): Promise<WebinarItem> => {
    const { data } = await apiClient.get<WebinarItem>(`/webinars/${encodeURIComponent(id)}`);
    return data;
  },

  /** Zoom Meeting Office Hours (published programs with zoomSessionType MEETING). */
  listOfficeHours: async (): Promise<WebinarItem[]> => {
    const { data } = await apiClient.get<WebinarItem[]>('/office-hours');
    return data || [];
  },

  getOfficeHoursById: async (id: string): Promise<WebinarItem> => {
    const { data } = await apiClient.get<WebinarItem>(`/office-hours/${encodeURIComponent(id)}`);
    return data;
  },

  /** Zoom Meeting SDK - office hours (MEETING); requires ZOOM_SDK_KEY / ZOOM_SDK_SECRET. */
  getMeetingSdkAuth: async (programId: string): Promise<MeetingSdkAuth> => {
    const { data } = await apiClient.post<MeetingSdkAuth>(
      `/office-hours/${encodeURIComponent(programId)}/meeting-sdk-auth`,
      {},
    );
    return data;
  },

  /** Zoom Meeting SDK - live webinar (WEBINAR); approved/enrolled learners only. */
  getWebinarMeetingSdkAuth: async (programId: string): Promise<MeetingSdkAuth> => {
    const { data } = await apiClient.post<MeetingSdkAuth>(
      `/webinars/${encodeURIComponent(programId)}/meeting-sdk-auth`,
      {},
    );
    return data;
  },

  reportWebinarSdkAttendance: async (
    programId: string,
    event: 'JOINED' | 'LEFT',
  ): Promise<void> => {
    await apiClient.post(`/webinars/${encodeURIComponent(programId)}/sdk-attendance`, {
      event,
    });
  },

  reportOfficeHoursSdkAttendance: async (
    programId: string,
    event: 'JOINED' | 'LEFT',
  ): Promise<void> => {
    await apiClient.post(`/office-hours/${encodeURIComponent(programId)}/sdk-attendance`, {
      event,
    });
  },
};
