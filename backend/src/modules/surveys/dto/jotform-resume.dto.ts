import { IsString, MinLength } from 'class-validator';

export class JotformResumeDto {
  @IsString()
  @MinLength(4, { message: 'sessionId must be a non-empty Jotform session value' })
  sessionId!: string;
}
