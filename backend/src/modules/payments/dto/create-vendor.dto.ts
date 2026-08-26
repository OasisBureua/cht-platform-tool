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

export class CreateVendorDto {
  @IsString()
  payeeName: string;

  @IsString()
  addressLine1: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  zipCode: string;

  /** ACH or CHECK — required for explicit payment method selection. */
  @IsString()
  @IsIn(['ACH', 'CHECK'])
  paymentMethod!: 'ACH' | 'CHECK';

  @ValidateIf((o: CreateVendorDto) => o.paymentMethod === 'ACH')
  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;
}
