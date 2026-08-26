import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateVideoProgressDto {
  @IsString()
  userId: string;

  @IsString()
  videoId: string;

  @IsNumber()
  watchedSeconds: number;

  @IsNumber()
  progress: number; // 0-100

  @IsBoolean()
  completed: boolean;
}

export class VideoProgressResponseDto {
  @IsString()
  id: string;

  @IsString()
  userId: string;

  @IsString()
  videoId: string;

  @IsNumber()
  watchedSeconds: number;

  @IsNumber()
  progress: number;

  @IsBoolean()
  completed: boolean;

  @IsString()
  @IsOptional()
  completedAt?: string;
}
