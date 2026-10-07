import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, MaxLength, Min } from 'class-validator';

/** Body of POST /api/internal/reports/:reportId/ready (cht-reports → platform). */
export class ReportReadyDto {
  @ApiProperty({
    description: 'Content Hub campaigns.id (DynamoDB partition key)',
    maxLength: 128,
  })
  @IsString()
  @MaxLength(128)
  @Matches(/^[^#\s][^#]*$/, {
    message: 'campaignId must be non-empty and cannot contain #',
  })
  campaignId!: string;

  @ApiProperty({
    description: 'Report version that just completed (1 = first report)',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  version!: number;
}
