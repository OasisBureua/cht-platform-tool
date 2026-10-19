import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import {
  DATE_RANGE_DAYS,
  type DateRangeDays,
} from '../../reports/dto/create-report.dto';

export class ReportInputsQueryDto {
  @ApiPropertyOptional({
    enum: DATE_RANGE_DAYS,
    description: 'Report the last N days, as Generate would',
  })
  @IsOptional()
  @Type(() => Number)
  @IsIn(DATE_RANGE_DAYS)
  dateRangeDays?: DateRangeDays;

  @ApiPropertyOptional({
    type: [String],
    description: 'Packet sources to include (omit for all)',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? [value] : value,
  )
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9_-]{1,64}$/, { each: true })
  sources?: string[];
}
