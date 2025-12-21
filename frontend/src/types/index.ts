export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'HCP' | 'KOL' | 'ADMIN';
}

// Re-export API types
export type {
  EarningsResponse,
  StatsResponse,
  WeeklyEarnings,
  PeerBenchmark,
} from '../api/dashboard';

export type {
  Program,
  Video,
  Enrollment,
} from '../api/programs';
