import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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

  /** Optional practice city (not required on registration). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** Required on registration/profile forms; 2-letter US state or DC code. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'state must be a 2-letter US state or DC code',
  })
  state?: string;

  /** Required on registration/profile forms; exactly 5 digits. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, {
    message: 'zipCode must be exactly 5 digits',
  })
  zipCode?: string;
}
