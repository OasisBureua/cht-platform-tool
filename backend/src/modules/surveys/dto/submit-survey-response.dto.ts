import { IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class SubmitSurveyResponseDto {
  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;
}
