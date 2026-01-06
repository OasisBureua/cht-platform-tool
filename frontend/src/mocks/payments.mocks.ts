export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';

export interface PaymentSummary {
  availableBalance: number; // ready to withdraw
  pendingBalance: number;   // processing
  lifetimeEarnings: number;
  lastPayoutDate?: string | null;
  stripeConnected: boolean;
  stripeAccountId?: string | null;
}

export interface PaymentItem {
  id: string;
  date: string; // ISO
  title: string;
  amount: number;
  status: PaymentStatus;
  method?: 'Stripe' | 'ACH' | 'Card' | 'N/A';
}

export const mockPaymentSummary: PaymentSummary = {
  availableBalance: 125.5,
  pendingBalance: 62.0,
  lifetimeEarnings: 2480.75,
  lastPayoutDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  stripeConnected: false,
  stripeAccountId: null,
};

export const mockPaymentItems: PaymentItem[] = [
  {
    id: 'pay_1',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    title: 'Webinar: Modern Cardiology',
    amount: 45,
    status: 'PENDING',
    method: 'Stripe',
  },
  {
    id: 'pay_2',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    title: 'Survey: Oncology Feedback',
    amount: 25,
    status: 'PROCESSING',
    method: 'Stripe',
  },
  {
    id: 'pay_3',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
    title: 'Webinar: Diabetes Updates',
    amount: 60,
    status: 'PAID',
    method: 'Stripe',
  },
];
