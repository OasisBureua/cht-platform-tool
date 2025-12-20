import apiClient from './client';

export interface WeeklyEarnings {
  weekStartDate: string;
  weekEndDate: string;
  amount: number;
  activitiesCount: number;
}

export interface EarningsData {
  totalEarnings: number;
  weeklyEarnings: WeeklyEarnings[];
  pendingPayments: number;
  lastPaymentDate?: string;
  currentWeekEarnings: number;
}

export interface StatsData {
  activitiesCompleted: number;
  activitiesInProgress: number;
  surveysCompleted: number;
  cmeCreditsEarned: number;
  completionRate: number;
  peerBenchmark?: {
    averageEarnings: number;
    percentile: number;
    topEarnersRange: string;
  };
}

export const dashboardApi = {
  getEarnings: async (): Promise<EarningsData> => {
    const { data } = await apiClient.get('/dashboard/earnings');
    return data;
  },

  getStats: async (): Promise<StatsData> => {
    const { data } = await apiClient.get('/dashboard/stats');
    return data;
  },
};
