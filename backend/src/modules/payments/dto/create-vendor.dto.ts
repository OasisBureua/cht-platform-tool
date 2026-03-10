import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
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

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;
}
