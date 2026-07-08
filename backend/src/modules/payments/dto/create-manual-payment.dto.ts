import {
  IsString,
  IsNumber,
  IsOptional,
  MaxLength,
  Min,
  IsEnum,
} from 'class-validator';
import { PaymentType } from '@prisma/client';

export class CreateManualPaymentDto {
  @IsString()
  userId: string;

  @IsString()
  @IsOptional()
  programId?: string;

  /** Amount in cents */
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;
}
