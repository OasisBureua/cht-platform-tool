import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

export class SetCampaignKolsDto {
  @ApiProperty({
    description: 'Content Hub KOL ids. Replaces the attached set.',
    type: [String],
    maxItems: 200,
  })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  kolIds!: string[];
}
