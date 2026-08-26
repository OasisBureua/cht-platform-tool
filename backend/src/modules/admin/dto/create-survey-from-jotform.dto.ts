import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateSurveyFromJotformDto {
  @IsString()
  programId: string;

  @IsString()
  templateFormId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(['PRE_TEST', 'POST_TEST', 'FEEDBACK'])
  type?: 'PRE_TEST' | 'POST_TEST' | 'FEEDBACK';
}
