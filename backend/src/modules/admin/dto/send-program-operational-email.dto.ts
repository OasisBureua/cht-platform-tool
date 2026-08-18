import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SendProgramOperationalEmailDto {
  @ApiProperty({
    type: [String],
    description: 'Recipient email addresses (max 50)',
    example: ['learner@example.com'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsEmail({}, { each: true })
  to!: string[];

  @ApiProperty({ example: 'Session update' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'Please note the updated join instructions…' })
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  body!: string;
}
