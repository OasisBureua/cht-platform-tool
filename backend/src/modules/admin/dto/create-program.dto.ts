import { IsString, IsOptional, IsNumber, IsEnum, IsDateString, Min } from 'class-validator';

export class CreateProgramDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  sponsorName: string;

  @IsOptional()
  @IsString()
  sponsorLogo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  creditAmount?: number;

  @IsOptional()
  @IsString()
  accreditationBody?: string;

  @IsOptional()
  @IsEnum(['DRAFT', 'PUBLISHED'])
  status?: 'DRAFT' | 'PUBLISHED';

  @IsOptional()
  @IsNumber()
  @Min(0)
  honorariumAmount?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

}
