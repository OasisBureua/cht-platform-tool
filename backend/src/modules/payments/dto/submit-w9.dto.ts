import { IsString, IsIn, IsOptional, Matches, MaxLength } from 'class-validator';

export class SubmitW9Dto {
  @IsString()
  @Matches(/^[\d\s-]{9,15}$/, {
    message: 'Tax ID must contain 9 digits (format: XXX-XX-XXXX or XXXXXXXXX)',
  })
  taxId: string;

  @IsIn(['SSN', 'EIN'])
  taxIdType: 'SSN' | 'EIN';

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Company name must be 200 characters or less' })
  companyName?: string;
}
