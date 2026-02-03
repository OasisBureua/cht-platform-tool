import { IsString, IsNumber, IsOptional } from 'class-validator';

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