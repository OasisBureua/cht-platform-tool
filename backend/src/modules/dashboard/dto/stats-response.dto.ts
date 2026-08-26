import { IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class PeerBenchmark {
  @IsNumber()
  averageEarnings: number;

  @IsNumber()
  percentile: number;

  @IsString()
  topEarnersRange: string;
}

export class StatsResponseDto {
  @IsNumber()
  activitiesCompleted: number;

  @IsNumber()
  activitiesInProgress: number;

  @IsNumber()
  surveysCompleted: number;

  @IsNumber()
  cmeCreditsEarned: number;

  @IsNumber()
  completionRate: number;

  @IsObject()
  @IsOptional()
  peerBenchmark?: PeerBenchmark;
}
