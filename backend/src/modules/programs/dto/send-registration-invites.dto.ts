import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
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

  @ApiPropertyOptional({
    type: [String],
    description: 'Specific user IDs to email',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Raw email addresses to invite (used for unregistered recipients). Duplicates of existing user emails are consolidated.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true })
  emails?: string[];

  @ApiPropertyOptional({
    enum: ['HCP', 'KOL'],
    description: 'Email all active users with this role when userIds omitted',
  })
  @IsOptional()
  @IsEnum(['HCP', 'KOL'])
  role?: 'HCP' | 'KOL';
}
