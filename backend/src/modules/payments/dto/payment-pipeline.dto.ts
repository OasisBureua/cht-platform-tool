import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PIPELINE_EXCEPTION_CODES,
  PIPELINE_STATUSES,
  type PipelineExceptionCode,
  type PipelineStatus,
} from './payment-pipeline.contract';

/**
 * SCRUM-292 response shape for GET /api/payments/pipeline (wired in Chunk 1).
 * Rules live in `payment-pipeline.contract.ts`. Admin only.
 * Do not add bank account, routing, or tax-id fields.
 */

export class PipelineAgingDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Whole days since survey completion; null when survey is not done',
  })
  daysSinceSurvey: number | null;

  @ApiProperty({ description: 'Inside the pay window and at or past the at-risk threshold' })
  atRisk: boolean;

  @ApiProperty({ description: 'Past the promised honorarium window' })
  overdue: boolean;
}

export class PipelineTotalsDto {
  @ApiProperty({ description: 'Committed honorarium cents', example: 50000 })
  committedCents: number;

  @ApiProperty({ description: 'Released (paid) cents', example: 25000 })
  releasedCents: number;

  @ApiProperty({ description: 'committedCents minus releasedCents', example: 25000 })
  outstandingCents: number;
}

export class PipelineRowDto {
  @ApiProperty({ enum: PIPELINE_STATUSES })
  status: PipelineStatus;

  @ApiProperty()
  programId: string;

  @ApiProperty()
  programTitle: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  userEmail: string;

  @ApiProperty({ description: 'Payment cents, else program honorarium cents' })
  amountCents: number;

  @ApiPropertyOptional({ nullable: true })
  surveyCompletedAt: string | null;

  @ApiProperty({ type: PipelineAgingDto })
  aging: PipelineAgingDto;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'new when this is the first honorarium confirmation; reused when a Stripe account was already in use. Null when the flag was not stored.',
    enum: ['new', 'reused'],
  })
  payoutDetailsOrigin: 'new' | 'reused' | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'When the learner confirmed payout details and requested the honorarium',
  })
  paymentDetailsConfirmedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  attendanceRecordedAt: string | null;

  @ApiPropertyOptional({ nullable: true })
  releaseAt: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Stripe transfer id (provider reference)' })
  stripeTransferId: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Stripe payout id (provider reference)' })
  stripePayoutId: string | null;

  @ApiPropertyOptional({ nullable: true })
  holdReason: string | null;

  @ApiProperty({ enum: PIPELINE_EXCEPTION_CODES, isArray: true })
  exceptions: PipelineExceptionCode[];

  @ApiProperty({ type: PipelineTotalsDto })
  totals: PipelineTotalsDto;
}

export class PipelineStatusCountDto {
  @ApiProperty({ enum: PIPELINE_STATUSES })
  status: PipelineStatus;

  @ApiProperty()
  count: number;
}

export class PipelineProgramTotalsDto {
  @ApiProperty()
  programId: string;

  @ApiProperty()
  programTitle: string;

  @ApiProperty({ type: PipelineTotalsDto })
  totals: PipelineTotalsDto;
}

export class PipelineExceptionDto {
  @ApiProperty({ enum: PIPELINE_EXCEPTION_CODES })
  code: PipelineExceptionCode;

  @ApiProperty({ description: 'Next action for an admin' })
  action: string;

  @ApiPropertyOptional({ nullable: true })
  programId: string | null;

  @ApiPropertyOptional({ nullable: true })
  programTitle: string | null;

  @ApiPropertyOptional({ nullable: true })
  userId: string | null;

  @ApiPropertyOptional({ nullable: true })
  userName: string | null;

  @ApiPropertyOptional({ nullable: true })
  userEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  surveyResponseId: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Stripe failure text for provider_error. Never a bank account or tax id.',
  })
  failureReason: string | null;
}

export class PipelineResponseDto {
  @ApiProperty({
    type: [PipelineStatusCountDto],
    description:
      'Counts for every status after program, date, and name/email filters. The status query does not change these counts.',
  })
  counts: PipelineStatusCountDto[];

  @ApiProperty({
    type: PipelineTotalsDto,
    description:
      'Honorarium totals after program, date, and name/email filters. The status query does not change these. Released counts paid rows that have a Stripe transfer.',
  })
  totals: PipelineTotalsDto;

  @ApiProperty({ type: [PipelineProgramTotalsDto] })
  programs: PipelineProgramTotalsDto[];

  @ApiProperty({
    type: [PipelineRowDto],
    description:
      'Unpaid rows past the program honorarium window, after program, date, and name/email filters. The status query does not remove these. Paid rows are omitted.',
  })
  overdueRows: PipelineRowDto[];

  @ApiProperty({ type: [PipelineRowDto] })
  rows: PipelineRowDto[];

  @ApiProperty({
    type: [PipelineExceptionDto],
    description:
      'Exception queue after program, date, and name/email filters. The status query does not remove these. Each item includes the next action.',
  })
  exceptions: PipelineExceptionDto[];
}
