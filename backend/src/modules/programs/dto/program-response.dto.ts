import { IsString, IsNumber, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class VideoDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  platform: string;

  @IsString()
  videoId: string;

  @IsString()
  embedUrl: string;

  @IsNumber()
  duration: number;

  @IsNumber()
  order: number;
}

export class ProgramResponseDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsNumber()
  creditAmount: number;

  @IsString()
  @IsOptional()
  accreditationBody?: string;

  @IsString()
  status: string;

  @IsString()
  sponsorName: string;

  @IsString()
  @IsOptional()
  sponsorLogo?: string;

  @IsNumber()
  @IsOptional()
  honorariumAmount?: number;

  @IsArray()
  videos: VideoDto[];
}
