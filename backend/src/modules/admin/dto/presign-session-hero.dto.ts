import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export class PresignSessionHeroDto {
  @ApiProperty({ enum: ALLOWED })
  @IsString()
  @IsIn([...ALLOWED])
  contentType!: string;

  @ApiProperty({ description: 'File size in bytes (max 5 MiB)' })
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  contentLength!: number;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fileName?: string;
}
