import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Bill.com GET /v3/funding-accounts/banks item (subset of fields). */
export class BillBankFundingAccountItemDto {
  @ApiProperty({
    description:
      'Funding bank account id (often `bac…`); use for BILL_FUNDING_ACCOUNT_ID',
  })
  id: string;

  @ApiProperty()
  archived: boolean;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  bankName?: string;

  @ApiPropertyOptional()
  nameOnAccount?: string;

  @ApiPropertyOptional({
    description:
      'When payables is true, Bill uses this account by default for AP debits',
  })
  default?: { payables?: boolean; receivables?: boolean };
}

/**
 * Bill.com bank list plus which id to use for BILL_FUNDING_ACCOUNT_ID.
 * Does not return passwords, dev keys, or session IDs.
 */
export class BillFundingAccountsResponseDto {
  @ApiPropertyOptional({ type: [BillBankFundingAccountItemDto] })
  results?: BillBankFundingAccountItemDto[];

  @ApiPropertyOptional()
  nextPage?: string;

  @ApiPropertyOptional()
  prevPage?: string;

  @ApiProperty({
    nullable: true,
    description:
      'Recommended value for BILL_FUNDING_ACCOUNT_ID: first non-archived account with default.payables === true',
  })
  recommendedFundingAccountId: string | null;

  @ApiProperty({
    description:
      'Why recommendedFundingAccountId was chosen, or what to do if it is null',
  })
  recommendationNote: string;

  @ApiPropertyOptional({
    description:
      'Current BILL_FUNDING_ACCOUNT_ID from server env (if set); not a secret',
  })
  configuredFundingAccountId?: string | null;

  @ApiPropertyOptional({
    description:
      'True when configuredFundingAccountId equals recommendedFundingAccountId',
  })
  configuredMatchesRecommended?: boolean;
}
