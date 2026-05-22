import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class SendRegistrationInvitesDto {
  @ApiProperty({ type: [String], description: 'Published webinar program IDs' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  programIds!: string[];

  @ApiPropertyOptional({ type: [String], description: 'Specific user IDs to email' })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ enum: ['HCP', 'KOL'], description: 'Email all active users with this role when userIds omitted' })
  @IsOptional()
  @IsEnum(['HCP', 'KOL'])
  role?: 'HCP' | 'KOL';
}
