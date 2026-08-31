import {
  IsString,
  IsOptional,
  IsObject,
  IsIn,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BankAccountDto {
  @IsString()
  nameOnAccount: string;

  @IsString()
  accountNumber: string;

  @IsString()
  routingNumber: string;
}

/** Bill.com vendor create body. All fields optional at the pipe so Stripe
 *  callers can POST /connect-account with an empty body; Bill path still
 *  validates required fields in the service. */
export class CreateVendorDto {
  @IsOptional()
  @IsString()
  payeeName?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  /** ACH or CHECK — required for Bill when creating/updating a vendor. */
  @IsOptional()
  @IsString()
  @IsIn(['ACH', 'CHECK'])
  paymentMethod?: 'ACH' | 'CHECK';

  @ValidateIf((o: CreateVendorDto) => o.paymentMethod === 'ACH')
  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;
}
