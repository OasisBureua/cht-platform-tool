import apiClient from './client';
import {
  mockPaymentItems,
  mockPaymentSummary,
  type PaymentItem,
  type PaymentSummary,
} from '../mocks/payments.mocks';

const ENABLE_MOCK_FALLBACK = import.meta.env.DEV;

export const paymentsApi = {
  getAccountStatus: async (userId: string) => {
    const { data } = await apiClient.get(`/payments/${userId}/account-status`);
    return data;
  },

  getSummary: async (userId: string): Promise<PaymentSummary> => {
    try {
      const { data } = await apiClient.get(`/payments/${userId}/summary`);
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return mockPaymentSummary;
      throw err;
    }
  },

  getHistory: async (userId: string): Promise<PaymentItem[]> => {
    try {
      const { data } = await apiClient.get(`/payments/${userId}/history`);
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return mockPaymentItems;
      throw err;
    }
  },

  /** Stripe Connect hosted Account Link. */
  createAccountLink: async (userId: string): Promise<{ url: string }> => {
    const { data } = await apiClient.post(`/payments/${userId}/account-link`);
    return { url: data.url || '/settings?tab=payment' };
  },

  /** @deprecated Use createAccountLink */
  createConnectLink: async (userId: string): Promise<{ url: string }> => {
    return paymentsApi.createAccountLink(userId);
  },

  /** Stripe Connect Embedded Account Session (client_secret + publishable key). */
  createAccountSession: async (
    userId: string,
  ): Promise<{
    clientSecret: string;
    publishableKey: string;
    accountId: string;
    expiresAt: number;
  }> => {
    const { data } = await apiClient.post(`/payments/${userId}/account-session`);
    return data;
  },

  /** Re-fetch Stripe Connect state and update local user flags. */
  syncAccountStatus: async (userId: string) => {
    const { data } = await apiClient.post(`/payments/${userId}/sync-account`);
    return data;
  },

  submitW9: async (
    userId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string },
  ) => {
    const { data: result } = await apiClient.post(`/payments/${userId}/w9`, data);
    return result;
  },

  requestPayout: async (userId: string, amount?: number, idempotencyKey?: string) => {
    try {
      const key =
        idempotencyKey ||
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      const { data } = await apiClient.post(`/payments/payout`, {
        userId,
        amount: amount ? Math.round(amount * 100) : 0,
        description: 'Payout request',
        idempotencyKey: key,
      });
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return { success: true };
      throw err;
    }
  },
};
