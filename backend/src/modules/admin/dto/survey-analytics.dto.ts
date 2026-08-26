import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SurveyType } from '@prisma/client';

/** One option bucket in a choice question distribution. */
export class ChoiceOptionCountDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  count: number;

  @ApiProperty({
    description:
      'Share of respondents who answered this question (0–100). Multi-select can sum above 100.',
  })
  percentage: number;
}

/** One discrete value bucket for a numeric/rating distribution. */
export class HistogramBucketDto {
  @ApiProperty()
  value: number;

  @ApiProperty()
  count: number;
}

/** Summary statistics for a numeric field (rating question or response score). */
export class NumericStatsDto {
  @ApiProperty()
  count: number;

  @ApiProperty({ nullable: true })
  mean: number | null;

  @ApiProperty({ nullable: true })
  median: number | null;

  @ApiProperty({ nullable: true })
  min: number | null;

  @ApiProperty({ nullable: true })
  max: number | null;

  @ApiProperty({ type: [HistogramBucketDto] })
  histogram: HistogramBucketDto[];
}

/** Completion against eligible (APPROVED) registrations; null when not applicable. */
export class CompletionRateDto {
  @ApiProperty()
  eligible: number;

  @ApiProperty()
  completed: number;

  @ApiProperty({ description: 'completed / eligible as a percentage (0–100).' })
  rate: number;
}

/** Response-level rollups for a survey. */
export class SurveyAnalyticsTotalsDto {
  @ApiProperty()
  totalResponses: number;

  @ApiProperty({
    description: 'Distinct respondents (anonymous rows counted individually).',
  })
  uniqueRespondents: number;

  @ApiProperty({
    nullable: true,
    description: 'ISO timestamp of the earliest response.',
  })
  firstResponseAt: string | null;

  @ApiProperty({
    nullable: true,
    description: 'ISO timestamp of the latest response.',
  })
  lastResponseAt: string | null;

  @ApiProperty({
    type: CompletionRateDto,
    nullable: true,
    description: 'Null for INTAKE surveys and surveys without a program.',
  })
  completionRate: CompletionRateDto | null;

  @ApiProperty({
    type: NumericStatsDto,
    nullable: true,
    description:
      'Response-level score summary (test surveys); null when no numeric scores.',
  })
  score: NumericStatsDto | null;
}

/** Daily response count. */
export class TimeSeriesPointDto {
  @ApiProperty({ description: 'UTC date (YYYY-MM-DD).' })
  date: string;

  @ApiProperty()
  count: number;
}

/**
 * Per-question aggregate. `kind` discriminates the payload:
 * - `choice` → `multiSelect`, `maxSelections?`, `totalAnswered`, `options`
 * - `rating` → numeric stats (`count`, `mean`, `median`, `min`, `max`, `histogram`)
 * - `text`   → `responseCount`, `samples`
 */
export class SurveyQuestionAnalyticsDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  prompt: string;

  @ApiProperty({
    description: 'Native schema type (or "unknown" for inferred keys).',
  })
  type: string;

  @ApiProperty({ enum: ['choice', 'rating', 'text'] })
  kind: 'choice' | 'rating' | 'text';

  @ApiPropertyOptional({
    description:
      'True when the aggregate was inferred from data (no native type).',
  })
  inferred?: boolean;

  // choice
  @ApiPropertyOptional()
  multiSelect?: boolean;

  @ApiPropertyOptional()
  maxSelections?: number;

  @ApiPropertyOptional({
    description: 'Number of responses that answered this question.',
  })
  totalAnswered?: number;

  @ApiPropertyOptional({ type: [ChoiceOptionCountDto] })
  options?: ChoiceOptionCountDto[];

  // rating (numeric stats)
  @ApiPropertyOptional()
  count?: number;

  @ApiPropertyOptional({ nullable: true })
  mean?: number | null;

  @ApiPropertyOptional({ nullable: true })
  median?: number | null;

  @ApiPropertyOptional({ nullable: true })
  min?: number | null;

  @ApiPropertyOptional({ nullable: true })
  max?: number | null;

  @ApiPropertyOptional({ type: [HistogramBucketDto] })
  histogram?: HistogramBucketDto[];

  // text
  @ApiPropertyOptional({
    description: 'Number of non-empty free-text responses.',
  })
  responseCount?: number;

  @ApiPropertyOptional({
    type: [String],
    description:
      'PII-safe sample answers (identity stripped, email/phone redacted).',
  })
  samples?: string[];
}

/** Per-question aggregates for one segment value (e.g. a specialty). */
export class SurveySegmentGroupDto {
  @ApiProperty({ description: 'Raw segment value ("unknown" when missing).' })
  key: string;

  @ApiProperty({
    description: 'Display label ("Unknown" for the missing bucket).',
  })
  label: string;

  @ApiProperty()
  totalResponses: number;

  @ApiProperty({
    type: [SurveyQuestionAnalyticsDto],
    description:
      'Counts-only aggregates for this segment (no free-text samples).',
  })
  questions: SurveyQuestionAnalyticsDto[];
}

/** Cross-cut breakdown grouped by a segment dimension. */
export class SurveySegmentBreakdownDto {
  @ApiProperty({ enum: ['specialty', 'status', 'attendance'] })
  dimension: 'specialty' | 'status' | 'attendance';

  @ApiProperty({ type: [SurveySegmentGroupDto] })
  groups: SurveySegmentGroupDto[];
}

/** Chart-ready analytics for a survey's responses. */
export class SurveyResponseAnalyticsDto {
  @ApiProperty()
  surveyType: string;

  @ApiProperty({ description: 'False for Jotform-sourced/empty schemas.' })
  hasNativeSchema: boolean;

  @ApiProperty({ type: SurveyAnalyticsTotalsDto })
  totals: SurveyAnalyticsTotalsDto;

  @ApiProperty({ type: [TimeSeriesPointDto] })
  timeSeries: TimeSeriesPointDto[];

  @ApiProperty({ type: [SurveyQuestionAnalyticsDto] })
  questions: SurveyQuestionAnalyticsDto[];

  @ApiProperty({
    type: SurveySegmentBreakdownDto,
    nullable: true,
    description:
      'Per-segment breakdown when segmentBy was provided; otherwise null.',
  })
  segments: SurveySegmentBreakdownDto | null;
}

/** Program the survey belongs to. */
export class SurveyAnalyticsProgramDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;
}

/** Survey the analytics were computed for. */
export class SurveyAnalyticsSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ enum: SurveyType })
  type: SurveyType;

  @ApiProperty({ type: SurveyAnalyticsProgramDto, nullable: true })
  program: SurveyAnalyticsProgramDto | null;
}

/** Response body for GET /admin/surveys/:id/analytics. */
export class SurveyAnalyticsDto {
  @ApiProperty({ type: SurveyAnalyticsSummaryDto })
  survey: SurveyAnalyticsSummaryDto;

  @ApiProperty({ type: SurveyResponseAnalyticsDto })
  analytics: SurveyResponseAnalyticsDto;
}
