import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export enum VideoPlatform {
    VIMEO = 'VIMEO',
    YOUTUBE = 'YOUTUBE',
}

export class CreateVideoDto {
  @IsString()
  programId: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(VideoPlatform)
  platform: VideoPlatform;

  @IsString()
  videoId: string;

  @IsString()
  embedUrl: string;

  @IsNumber()
  duration: number;

  @IsNumber()
  @IsOptional()
  order?: number;
}