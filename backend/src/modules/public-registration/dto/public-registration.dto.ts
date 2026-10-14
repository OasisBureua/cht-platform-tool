import {
  IsEmail,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PublicRegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}

export class PublicSurveySubmitDto {
  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  recaptchaToken?: string;
}
