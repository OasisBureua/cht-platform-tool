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
}

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
};
