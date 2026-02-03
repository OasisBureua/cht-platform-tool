import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class AccountStatusDto {
  @IsBoolean()
  hasAccount: boolean;

  @IsString()
  @IsOptional()
  accountId?: string;

  @IsString()
  @IsOptional()
  accountStatus?: string;

  @IsBoolean()
  paymentEnabled: boolean;

  @IsBoolean()
  w9Submitted: boolean;

  @IsString()
  @IsOptional()
  w9SubmittedAt?: string;

  @IsNumber()
  totalEarnings: number;

  @IsBoolean()
  chargesEnabled: boolean;

  @IsBoolean()
  payoutsEnabled: boolean;

  @IsBoolean()
  detailsSubmitted: boolean;
}