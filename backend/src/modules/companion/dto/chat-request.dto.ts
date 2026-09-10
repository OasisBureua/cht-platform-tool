import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatHistoryTurnDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(8192)
  content!: string;
}

export class ChatOptionsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2048)
  max_tokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}

export class ChatRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  query!: string;

  @IsOptional()
  @IsString()
  conversation_id?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryTurnDto)
  history?: ChatHistoryTurnDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatOptionsDto)
  options?: ChatOptionsDto;
}
