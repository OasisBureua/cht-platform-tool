import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SCRUM-275 API contract (Chunk 0) — freeze before service/route wiring.
 *
 * ## GET /api/payments/program-summary (ADMIN only)
 * All-time aggregates from Payment rows, grouped by programId.
 * Statuses included: PENDING, PAID, FAILED only.
 * Statuses excluded from these columns: PROCESSING, CANCELLED.
 * programId null → "No program" bucket.
 * Sort: title A–Z; No program last.
 *
 * ## List scope query (pending / failed / paid)
 * Optional query `programId`:
 * - omitted → current behavior (paid remains recent-window capped)
 * - `none` → payments with programId IS NULL
 * - `<cuid>` → payments for that program
 *
 * Constant for the null-program filter value: {@link PROGRAM_PAYMENT_SCOPE_NONE}.
 *
 * SCRUM-292 phase 2 does not change this summary. The honorarium pipeline
 * (status, aging, totals, CSV) is frozen in `payment-pipeline.contract.ts`.
 */

/** Query value meaning Payment.programId IS NULL on list endpoints. */
export const PROGRAM_PAYMENT_SCOPE_NONE = 'none' as const;

export class ProgramPaymentStatusTotalsDto {
  @ApiProperty({ description: 'Number of payments in this status', example: 3 })
  count: number;

  @ApiProperty({
    description: 'Sum of amount (cents) for this status',
    example: 75000,
  })
  totalCents: number;
}

export class ProgramPaymentSummaryItemDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'Program id, or null for payments with no program',
    example: 'clx...',
  })
  programId: string | null;

  @ApiProperty({ example: 'Cardiology Treatment Webinar' })
  title: string;

  @ApiPropertyOptional({ nullable: true, example: 'CHM-123' })
  chmProgramId: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Pfizer' })
  sponsorName: string | null;

  @ApiProperty({ type: ProgramPaymentStatusTotalsDto })
  pending: ProgramPaymentStatusTotalsDto;

  @ApiProperty({ type: ProgramPaymentStatusTotalsDto })
  paid: ProgramPaymentStatusTotalsDto;

  @ApiProperty({ type: ProgramPaymentStatusTotalsDto })
  failed: ProgramPaymentStatusTotalsDto;
}

export class ProgramPaymentSummaryResponseDto {
  @ApiProperty({ type: [ProgramPaymentSummaryItemDto] })
  programs: ProgramPaymentSummaryItemDto[];
}
