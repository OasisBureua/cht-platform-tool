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
  @IsOptional()
  @IsString()
  payeeName?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount?: BankAccountDto;

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
}
