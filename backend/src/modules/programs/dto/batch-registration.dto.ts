import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

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

  @ApiPropertyOptional({
    description:
      'Optional Jotform intake submission id per programId (from multi-register intake step)',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  intakeByProgramId?: Record<string, string>;
}
