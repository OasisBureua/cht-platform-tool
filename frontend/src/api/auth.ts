import apiClient from './client';

export const authApi = {
  /**
   * Permanently delete the signed-in account. confirmEmail must match the
   * account email. Clears the session cookie on success.
   */
  deleteAccount: async (confirmEmail: string) => {
    const { data } = await apiClient.delete<{ deleted: true }>('/auth/account', {
      data: { confirmEmail },
    });
    return data;
  },
};
