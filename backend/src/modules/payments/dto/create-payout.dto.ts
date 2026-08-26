import { IsString, IsNumber, IsOptional, MaxLength } from 'class-validator';

export class CreatePayoutDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  programId?: string;

  @IsNumber()
  amount: number; // Amount in cents

  @IsString()
  @IsOptional()
  description?: string;

  /** Same key on retry returns the same result (Stripe-style). Omit to let the server generate a one-off key (no cross-retry dedupe). */
  @IsString()
  @IsOptional()
  @MaxLength(200)
  idempotencyKey?: string;
}

export class PayoutResponseDto {
  @IsString()
  paymentId: string;

  @IsNumber()
  amount: number;

  @IsString()
  status: string;

  @IsString()
  transferId: string;
}
