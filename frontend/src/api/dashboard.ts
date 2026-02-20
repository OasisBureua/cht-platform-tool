import apiClient from './client';

export interface WeeklyEarnings {
  weekStartDate: string;
  weekEndDate: string;
  amount: number;
  activitiesCount: number;
}

export interface EarningsResponse {
  totalEarnings: number;
  weeklyEarnings: WeeklyEarnings[];
  pendingPayments: number;
  lastPaymentDate?: string;
  currentWeekEarnings: number;
}

export interface PeerBenchmark {
  averageEarnings: number;
  percentile: number;
  topEarnersRange: string;
}

export interface StatsResponse {
  activitiesCompleted: number;
  activitiesInProgress: number;
  surveysCompleted: number;
  cmeCreditsEarned: number;
  completionRate: number;
  peerBenchmark?: PeerBenchmark;
}

export interface ProfileResponse {
  firstName: string;
  lastName: string;
  email: string;
  name: string;
  specialty?: string;
  role: string;
  createdAt: string;
  totalEarnings: number;
  activitiesCompleted: number;
}

export const dashboardApi = {
  getEarnings: async (userId: string): Promise<EarningsResponse> => {
    const { data } = await apiClient.get(`/dashboard/${userId}/earnings`);
    return data;
  },

  getStats: async (userId: string): Promise<StatsResponse> => {
    const { data } = await apiClient.get(`/dashboard/${userId}/stats`);
    return data;
  },

  getProfile: async (userId: string): Promise<ProfileResponse> => {
    const { data } = await apiClient.get(`/dashboard/${userId}/profile`);
    return data;
  },
};
