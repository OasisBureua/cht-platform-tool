import { IsString, IsIn, IsOptional } from 'class-validator';

export class SubmitW9Dto {
  @IsString()
  taxId: string;

  @IsIn(['SSN', 'EIN'])
  taxIdType: 'SSN' | 'EIN';

  @IsOptional()
  @IsString()
  companyName?: string;
}
