import apiClient from './client';

/** Public registration (no login): program page, register, and the emailed survey link. */
export interface PublicRegistrationProgram {
  id: string;
  title: string;
  description: string;
  sponsorName: string;
  startDate: string | null;
  heroImageUrl: string | null;
}

export interface PublicRegistrationSurvey {
  program: { id: string; title: string; sponsorName: string };
  survey: { id: string; title: string; description: string | null; questions: unknown };
  registrant: { firstName: string };
  submittedAt: string | null;
}

export const publicRegistrationApi = {
  getProgram: async (programId: string) => {
    const { data } = await apiClient.get<PublicRegistrationProgram>(
      `/public/programs/${encodeURIComponent(programId)}/registration`,
    );
    return data;
  },

  register: async (
    programId: string,
    payload: { firstName: string; lastName: string; email: string; recaptchaToken?: string },
  ) => {
    const { data } = await apiClient.post<{ ok: true }>(
      `/public/programs/${encodeURIComponent(programId)}/registration`,
      payload,
    );
    return data;
  },

  getSurvey: async (token: string) => {
    const { data } = await apiClient.get<PublicRegistrationSurvey>(
      `/public/registration-survey/${encodeURIComponent(token)}`,
    );
    return data;
  },

  submitSurvey: async (token: string, answers: Record<string, unknown>) => {
    const { data } = await apiClient.post<{ submittedAt: string }>(
      `/public/registration-survey/${encodeURIComponent(token)}`,
      { answers },
    );
    return data;
  },
};
