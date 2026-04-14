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

  createConnectLink: async (userId: string): Promise<{ url: string }> => {
    try {
      const { data } = await apiClient.post(`/payments/${userId}/connect-account`);
      return { url: data.onboardingUrl || data.url || '/app/payments' };
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return { url: '/app/payments' };
      throw err;
    }
  },

  /** Submit bank + address details to create Bill.com vendor (US only) */
  createConnectAccount: async (
    userId: string,
    bankData: {
      payeeName: string;
      addressLine1: string;
      city: string;
      state: string;
      zipCode: string;
      nameOnAccount: string;
      accountNumber: string;
      routingNumber: string;
    },
  ) => {
    const { data } = await apiClient.post(`/payments/${userId}/connect-account`, {
      payeeName: bankData.payeeName,
      addressLine1: bankData.addressLine1,
      city: bankData.city,
      state: bankData.state,
      zipCode: bankData.zipCode,
      bankAccount: {
        nameOnAccount: bankData.nameOnAccount,
        accountNumber: bankData.accountNumber,
        routingNumber: bankData.routingNumber,
      },
    });
    return data;
  },

  getBillElementSession: async (): Promise<{ sessionId: string; userId: string; orgId: string; devKey: string }> => {
    const { data } = await apiClient.get('/payments/bill-element-session');
    return data;
  },

  saveVendorId: async (userId: string, vendorId: string) => {
    const { data } = await apiClient.post(`/payments/${userId}/save-vendor-id`, { vendorId });
    return data;
  },

  submitW9: async (
    userId: string,
    data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string },
  ) => {
    const { data: result } = await apiClient.post(`/payments/${userId}/w9`, data);
    return result;
  },

  requestPayout: async (userId: string, amount?: number) => {
    try {
      const { data } = await apiClient.post(`/payments/payout`, {
        userId,
        amount: amount ? Math.round(amount * 100) : 0,
        description: 'Payout request',
      });
      return data;
    } catch (err) {
      if (ENABLE_MOCK_FALLBACK) return { success: true };
      throw err;
    }
  },
};
