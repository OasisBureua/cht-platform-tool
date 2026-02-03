import apiClient from './client';
import {
  mockPaymentItems,
  mockPaymentSummary,
  type PaymentItem,
  type PaymentSummary,
} from '../mocks/payments.mocks';

const ENABLE_MOCK_FALLBACK = true;

// TODO: replace TEMP_USER_ID once auth exists
const TEMP_USER_ID = '1234567890';

export const paymentsApi = {
  getSummary: async (): Promise<PaymentSummary> => {
    try {
      const { data } = await apiClient.get(`/payments/${TEMP_USER_ID}/summary`);
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return mockPaymentSummary;
      throw err;
    }
  },

  getHistory: async (): Promise<PaymentItem[]> => {
    try {
      const { data } = await apiClient.get(`/payments/${TEMP_USER_ID}/history`);
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return mockPaymentItems;
      throw err;
    }
  },

  // Stripe Connect onboarding link
  createConnectLink: async (): Promise<{ url: string }> => {
    try {
      const { data } = await apiClient.post(`/payments/${TEMP_USER_ID}/stripe/connect-link`);
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) {
        return { url: 'https://dashboard.stripe.com/' };
      }
      throw err;
    }
  },

  requestPayout: async (amount?: number) => {
    try {
      const { data } = await apiClient.post(`/payments/${TEMP_USER_ID}/payout`, { amount });
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return { success: true };
      throw err;
    }
  },
};
