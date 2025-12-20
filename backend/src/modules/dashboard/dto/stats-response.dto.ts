export class StatsResponseDto {
  activitiesCompleted: number;
  activitiesInProgress: number;
  surveysCompleted: number;
  cmeCreditsEarned: number;
  completionRate: number;       // Percentage (0-100)
  peerBenchmark?: PeerBenchmark;
}

export class PeerBenchmark {
  averageEarnings: number;      // Anonymous average (in dollars)
  percentile: number;           // User's percentile (0-100)
  topEarnersRange: string;      // e.g., "$500-$1000"
}