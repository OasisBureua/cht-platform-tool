export class EarningsResponseDto {
  totalEarnings: number;        // Total lifetime earnings (in dollars)
  weeklyEarnings: WeeklyEarnings[];
  pendingPayments: number;      // Pending amount (in dollars)
  lastPaymentDate?: string;
  currentWeekEarnings: number;  // This week's earnings (in dollars)
}

export class WeeklyEarnings {
  weekStartDate: string;        // ISO date string
  weekEndDate: string;
  amount: number;               // Earnings for that week (in dollars)
  activitiesCount: number;      // Number of activities that week
}