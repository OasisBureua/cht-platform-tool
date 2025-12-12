import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum ProgramStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export class CreateProgramDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsNumber()
  creditAmount: number;

  @IsString()
  @IsOptional()
  accreditationBody?: string;

  @IsEnum(ProgramStatus)
  @IsOptional()
  status?: ProgramStatus;

  @IsString()
  sponsorName: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}