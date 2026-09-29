import apiClient from './client';

export const termsApi = {
  accept: async (version: string) => {
    const { data } = await apiClient.post<{
      termsAccepted: true;
      termsVersion: string;
      termsAcceptedAt: string;
    }>('/auth/terms/accept', { version });
    return data;
  },
  decline: async () => {
    await apiClient.post('/auth/terms/decline');
  },
};
