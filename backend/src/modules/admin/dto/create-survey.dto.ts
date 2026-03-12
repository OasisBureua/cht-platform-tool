import { IsString, IsOptional, IsArray, IsEnum, IsBoolean, IsObject } from 'class-validator';

export class CreateSurveyDto {
  @IsString()
  programId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  questions: Record<string, unknown>[];

  @IsOptional()
  @IsEnum(['PRE_TEST', 'POST_TEST', 'FEEDBACK'])
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Link to an existing Jotform form. When set, the survey will embed this form and receive webhook submissions. */
  @IsOptional()
  @IsString()
  jotformFormId?: string;
}
