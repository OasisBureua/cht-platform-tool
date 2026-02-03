import { IsNumber, IsArray, IsString, IsOptional } from 'class-validator';

export class WeeklyEarnings {
    @IsString()
    weekStartDate: string;

    @IsString()
    weekEndDate: string;

    @IsNumber()
    amount: number;

    @IsNumber()
    activitiesCount: number;
}

export class EarningsResponseDto {
    @IsNumber()
    totalEarnings: number;

    @IsArray()
  weeklyEarnings: WeeklyEarnings[];

  @IsNumber()
  pendingPayments: number;

  @IsString()
  @IsOptional()
  lastPaymentDate?: string;

  @IsNumber()
  currentWeekEarnings: number;
}