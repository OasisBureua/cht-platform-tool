import apiClient from './client';

export const termsApi = {
  accept: async (
    version: string,
    opts?: { betaAccepted?: boolean; betaVersion?: string },
  ) => {
    const { data } = await apiClient.post<{
      termsAccepted: true;
      termsVersion: string;
      termsAcceptedAt: string;
      betaTermsAccepted?: boolean;
      betaTermsVersion?: string | null;
      betaTermsAcceptedAt?: string | null;
    }>('/auth/terms/accept', {
      version,
      ...(opts?.betaAccepted ? { betaAccepted: true } : {}),
      ...(opts?.betaVersion ? { betaVersion: opts.betaVersion } : {}),
    });
    return data;
  },
  decline: async () => {
    await apiClient.post('/auth/terms/decline');
  },
};
