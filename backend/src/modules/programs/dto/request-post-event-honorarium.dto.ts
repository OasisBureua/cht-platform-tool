import { IsEnum, IsOptional } from 'class-validator';
import { PayoutDetailsEntryKind } from '@prisma/client';

export class RequestPostEventHonorariumDto {
  /**
   * How payout details were confirmed for this program.
   * REUSED = existing Stripe details; NEWLY_ENTERED = set up or edited in this flow.
   */
  @IsOptional()
  @IsEnum(PayoutDetailsEntryKind)
  entryKind?: PayoutDetailsEntryKind;
}
