import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProfileResponseDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  specialty?: string;

  @IsString()
  role: string;

  @IsDateString()
  createdAt: string;

  @IsNumber()
  totalEarnings: number;

  @IsNumber()
  activitiesCompleted: number;
}
