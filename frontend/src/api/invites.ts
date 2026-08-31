import apiClient from './client';

/**
 * SCRUM-175: opaque invite-token flow. When an admin invites an
 * unregistered email to a webinar, the invite URL is
 * `https://.../join?invite=<token>`. The Join page hits `getInvite(token)`
 * to resolve the token server-side and pre-fill the signup form with the
 * invited email + target programs. After successful signup, the frontend
 * calls `consumeInvite(token)` to mark the token used.
 */

export interface ResolvedInvite {
  email: string;
  programIds: string[];
}

export const invitesApi = {
  async getInvite(token: string): Promise<ResolvedInvite> {
    const { data } = await apiClient.get<ResolvedInvite>(
      `/invites/${encodeURIComponent(token)}`,
    );
    return data;
  },

  async consumeInvite(token: string): Promise<void> {
    await apiClient.post(`/invites/${encodeURIComponent(token)}/consume`);
  },
};
