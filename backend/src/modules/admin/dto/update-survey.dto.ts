import { IsOptional, IsString } from 'class-validator';

export class UpdateSurveyDto {
  /** Link to an existing Jotform form. When set, the survey will embed this form and receive webhook submissions. */
  @IsOptional()
  @IsString()
  jotformFormId?: string;
}
