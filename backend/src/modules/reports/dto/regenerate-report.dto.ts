import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RegenerateReportDto {
  @ApiPropertyOptional({
    description: 'Free-text changes for this regeneration',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  editInstructions?: string;
}
