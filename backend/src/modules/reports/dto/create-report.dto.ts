import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const DATE_RANGE_DAYS = [30, 60, 90] as const;
export type DateRangeDays = (typeof DATE_RANGE_DAYS)[number];

export class CreateReportDto {
  @ApiProperty({ description: 'Content Hub campaigns.id', maxLength: 128 })
  @IsString()
  @MaxLength(128)
  @Matches(/^[^#\s][^#]*$/, {
    message: 'campaignId must be non-empty and cannot contain #',
  })
  campaignId!: string;

  @ApiPropertyOptional({
    description: 'Report template type (defaults to executive_summary)',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_-]{1,64}$/, {
    message: 'templateType must be lowercase letters, digits, _ or -',
  })
  templateType?: string;

  @ApiPropertyOptional({
    enum: DATE_RANGE_DAYS,
    description:
      'Report the last N days, frozen at request time. Cannot be combined with windowStart/windowEnd.',
  })
  @IsOptional()
  @IsIn(DATE_RANGE_DAYS)
  dateRangeDays?: DateRangeDays;

  @ApiPropertyOptional({
    description:
      'Window start (ISO 8601). Omit for campaign start. Cannot be combined with dateRangeDays.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  windowStart?: string;

  @ApiPropertyOptional({
    description: 'Window end (ISO 8601). Omit to freeze at request time.',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  windowEnd?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Packet sources to include (omit for all)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Matches(/^[a-z0-9_-]{1,64}$/, { each: true })
  sources?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Email addresses to notify when the report is ready',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
      : value,
  )
  @IsEmail({}, { each: true })
  @MaxLength(254, { each: true })
  notifyEmails?: string[];
}
