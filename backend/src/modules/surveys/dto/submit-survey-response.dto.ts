import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class SubmitSurveyResponseDto {
  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  /**
   * When true, upsert answers without completing the survey
   * (no post-event acknowledge, no survey bonus). Used before payment setup.
   */
  @IsOptional()
  @IsBoolean()
  draft?: boolean;
}
