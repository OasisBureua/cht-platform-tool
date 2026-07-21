import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';

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
  @IsEnum(['PRE_TEST', 'POST_TEST', 'FEEDBACK', 'INTAKE'])
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK' | 'INTAKE';

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Link to an existing Jotform form. When set, the survey will embed this form and receive webhook submissions. */
  @IsOptional()
  @IsString()
  jotformFormId?: string;
}
