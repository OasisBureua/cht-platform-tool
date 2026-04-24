import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  npiNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  zipCode?: string;
}
