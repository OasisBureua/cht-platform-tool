import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from 'class-validator';

export class BatchSubmitRegistrationsDto {
  @ApiProperty({
    description: 'Program IDs for live webinars to register for',
    type: [String],
    minItems: 1,
    maxItems: 25,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(25)
  @IsString({ each: true })
  programIds!: string[];
}
