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
  jotformIntakeFormUrl?: string;
  registrationRequiresApproval?: boolean;
}

/** Response from POST /office-hours/:id/meeting-sdk-auth for Zoom Meeting SDK embedded client. */
export type MeetingSdkAuth = {
  signature: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail?: string;
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

  /** Zoom Meeting SDK - enrolled users only; requires backend ZOOM_SDK_KEY / ZOOM_SDK_SECRET. */
  getMeetingSdkAuth: async (programId: string): Promise<MeetingSdkAuth> => {
    const { data } = await apiClient.post<MeetingSdkAuth>(
      `/office-hours/${encodeURIComponent(programId)}/meeting-sdk-auth`,
      {},
    );
    return data;
  },
};
