import { IsObject, IsOptional } from 'class-validator';

export class SubmitSurveyResponseDto {
  @IsObject()
  answers: Record<string, unknown>;

  @IsOptional()
  score?: number;
}
