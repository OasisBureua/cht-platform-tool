import {
  IsString,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsIn,
} from 'class-validator';

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

  /** True when Stripe Connect is the active payment rail for this environment. */
  @IsBoolean()
  @IsOptional()
  usesStripeConnect?: boolean;

  @IsOptional()
  @IsIn(['ACH', 'CHECK'])
  preferredPaymentMethod?: 'ACH' | 'CHECK' | null;

  @IsOptional()
  @IsString()
  bankAccountLast4?: string | null;
}
