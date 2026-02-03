import { IsString, IsNumber } from 'class-validator';

export class CreateConnectAccountDto {
  @IsString()
  userId: string;
}

export class CreateConnectAccountResponseDto {
  @IsString()
  accountId: string;

  @IsString()
  onboardingUrl: string;

  @IsString()
  accountStatus: string;
}

export class AccountLinkResponseDto {
  @IsString()
  url: string;

  @IsNumber()
  expiresAt: number;
}