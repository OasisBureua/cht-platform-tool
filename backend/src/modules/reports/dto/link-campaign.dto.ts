import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

export class LinkCampaignDto {
  @ApiProperty({
    description:
      'Content Hub campaigns.id as a string (e.g. "42"). null clears the link.',
    nullable: true,
    type: String,
  })
  @ValidateIf((o: LinkCampaignDto) => o.campaignId !== null)
  @IsString()
  @MaxLength(128)
  @Matches(/^[^#\s][^#]*$/, {
    message: 'campaignId must be non-empty and cannot contain #',
  })
  campaignId!: string | null;
}
